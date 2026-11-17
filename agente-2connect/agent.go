package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var (
	logToConsole bool
	logMu        sync.Mutex
)

func logf(format string, a ...any) {
	line := time.Now().Format("2006-01-02 15:04:05") + "  " + fmt.Sprintf(format, a...) + "\r\n"
	logMu.Lock()
	defer logMu.Unlock()
	if logToConsole {
		fmt.Print(line)
	}
	p := filepath.Join(baseDir(), "agente.log")
	if st, err := os.Stat(p); err == nil && st.Size() > 5<<20 {
		_ = os.Rename(p, p+".anterior")
	}
	if f, err := os.OpenFile(p, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644); err == nil {
		_, _ = f.WriteString(line)
		_ = f.Close()
	}
}

// ---------- Servidor Chronos ----------

var httpClient = &http.Client{Timeout: 20 * time.Second}

func apiRequest(cfg *Config, method, path string, body any, out any) error {
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, cfg.ServerURL+path, rd)
	if err != nil {
		return err
	}
	req.Header.Set("x-api-key", cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
	if resp.StatusCode != 200 {
		msg := string(data)
		if len(msg) > 200 {
			msg = msg[:200]
		}
		return fmt.Errorf("servidor respondió %d: %s", resp.StatusCode, msg)
	}
	if out != nil {
		if err := json.Unmarshal(data, out); err != nil {
			return fmt.Errorf("respuesta inesperada del servidor (¿URL correcta?): %v", err)
		}
	}
	return nil
}

func fetchTemplates(cfg *Config) ([]Template, error) {
	var r struct {
		OK        bool       `json:"ok"`
		Templates []Template `json:"templates"`
	}
	if err := apiRequest(cfg, "GET", "/api/clock/templates", nil, &r); err != nil {
		return nil, err
	}
	return r.Templates, nil
}

// ---------- Estado compartido ----------

type Punch struct {
	UserID    string `json:"userId"`
	Name      string `json:"name"`
	Timestamp string `json:"timestamp"`
}

type state struct {
	mu        sync.Mutex
	templates []Template
	queue     []Punch
	lastSeen  map[string]time.Time
}

func (s *state) path(name string) string { return filepath.Join(baseDir(), name) }

func (s *state) loadFiles() {
	if b, err := os.ReadFile(s.path("plantillas.json")); err == nil {
		_ = json.Unmarshal(b, &s.templates)
	}
	if b, err := os.ReadFile(s.path("pendientes.json")); err == nil {
		_ = json.Unmarshal(b, &s.queue)
	}
}

func (s *state) saveQueueLocked() {
	b, _ := json.Marshal(s.queue)
	_ = os.WriteFile(s.path("pendientes.json"), b, 0600)
}

func (s *state) getTemplates() []Template {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.templates
}

func (s *state) refreshTemplates(cfg *Config) {
	t, err := fetchTemplates(cfg)
	if err != nil {
		logf("No se pudieron descargar las huellas (se usan las guardadas): %v", err)
		return
	}
	s.mu.Lock()
	changed := len(t) != len(s.templates)
	s.templates = t
	s.mu.Unlock()
	b, _ := json.Marshal(t)
	_ = os.WriteFile(s.path("plantillas.json"), b, 0600)
	if changed {
		logf("Huellas registradas descargadas: %d empleados", len(t))
	}
}

func (s *state) enqueue(p Punch) {
	s.mu.Lock()
	s.queue = append(s.queue, p)
	s.saveQueueLocked()
	s.mu.Unlock()
}

func (s *state) flush(cfg *Config) {
	s.mu.Lock()
	batch := append([]Punch(nil), s.queue...)
	s.mu.Unlock()
	if len(batch) == 0 {
		return
	}
	if len(batch) > 400 {
		batch = batch[:400]
	}
	items := make([]map[string]string, len(batch))
	for i, p := range batch {
		items[i] = map[string]string{"userId": p.UserID, "timestamp": p.Timestamp}
	}
	var r struct {
		Saved      int      `json:"saved"`
		Duplicates int      `json:"duplicates"`
		Unknown    []string `json:"unknownDeviceUsers"`
	}
	if err := apiRequest(cfg, "POST", "/api/clock/punches", map[string]any{"deviceSerial": cfg.DeviceName, "punches": items}, &r); err != nil {
		logf("Sin conexión con el servidor; %d ponche(s) en espera: %v", len(s.queue), err)
		return
	}
	s.mu.Lock()
	s.queue = s.queue[len(batch):]
	s.saveQueueLocked()
	s.mu.Unlock()
	logf("Enviados al servidor: %d guardados, %d duplicados%s", r.Saved, r.Duplicates,
		map[bool]string{true: fmt.Sprintf(", usuarios desconocidos: %v", r.Unknown), false: ""}[len(r.Unknown) > 0])
}

// inCooldown evita doble ponche si la persona pone el dedo dos veces seguidas.
func (s *state) inCooldown(userID string, secs int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.lastSeen == nil {
		s.lastSeen = map[string]time.Time{}
	}
	if t, ok := s.lastSeen[userID]; ok && time.Since(t) < time.Duration(secs)*time.Second {
		return true
	}
	s.lastSeen[userID] = time.Now()
	return false
}

// ---------- Bucle principal ----------

const lockAddr = "127.0.0.1:47321"

func runAgent() {
	// Una sola instancia (si no, dos programas pelean por el lector).
	ln, err := net.Listen("tcp", lockAddr)
	if err != nil {
		logf("El agente ya está corriendo en esta PC. Saliendo.")
		if logToConsole {
			fmt.Println("Si lo instaló, ya está funcionando en segundo plano. Para verlo en vivo, primero desinstálelo.")
		}
		return
	}
	defer ln.Close()

	cfg := mustConfig(false)
	logf("=== Agente 2Connect v%s iniciado. Servidor: %s  Lector: %s ===", version, cfg.ServerURL, cfg.ReaderURL)

	st := &state{}
	st.loadFiles()
	go func() { _ = http.Serve(ln, statusHandler(st)) }()

	go func() {
		for {
			st.refreshTemplates(cfg)
			time.Sleep(time.Duration(cfg.RefreshMinutes) * time.Minute)
		}
	}()
	go func() {
		for {
			st.flush(cfg)
			time.Sleep(30 * time.Second)
		}
	}()

	failures := 0
	for {
		r, err := dialReader(cfg.ReaderURL)
		if err != nil {
			failures++
			if failures == 1 || failures%60 == 0 {
				logf("No se puede conectar al servicio del lector 2Connect (%s): %v", cfg.ReaderURL, err)
			}
			if (failures == 1 || failures%60 == 0) && cfg.ReaderStartCommand != "" {
				logf("Iniciando el servicio del lector: %s", cfg.ReaderStartCommand)
				if err := startDetached(cfg.ReaderStartCommand); err != nil {
					logf("No se pudo iniciar el servicio del lector: %v", err)
				}
			}
			time.Sleep(5 * time.Second)
			continue
		}
		logf("Conectado al lector 2Connect. Esperando huellas...")
		failures = 0
		readLoop(cfg, st, r)
		r.Close()
		time.Sleep(2 * time.Second)
	}
}

func readLoop(cfg *Config, st *state, r *Reader) {
	for {
		captured, err := r.Capture(5*time.Minute, nil)
		if err == errNoFinger {
			return // reconectar para empezar limpio
		}
		if err != nil {
			if isConnErr(err) {
				logf("Se perdió la conexión con el lector: %v", err)
				return
			}
			beepFail()
			time.Sleep(time.Second)
			continue
		}
		list := st.getTemplates()
		if len(list) == 0 {
			logf("Huella leída, pero no hay empleados con huella registrada (o no se han descargado).")
			beepFail()
			continue
		}
		best, score, err := r.Identify(captured, list)
		if err != nil {
			logf("Error comparando huella: %v", err)
			return
		}
		if best == nil || score < cfg.MatchThreshold {
			logf("Huella NO reconocida (mejor puntaje %d, mínimo %d)", score, cfg.MatchThreshold)
			beepFail()
			time.Sleep(time.Second)
			continue
		}
		if st.inCooldown(best.UserID, cfg.CooldownSeconds) {
			logf("%s ya ponchó hace menos de %ds; se ignora la repetición.", best.Name, cfg.CooldownSeconds)
			beepOK()
			time.Sleep(time.Second)
			continue
		}
		p := Punch{UserID: best.UserID, Name: best.Name, Timestamp: time.Now().UTC().Format(time.RFC3339)}
		st.enqueue(p)
		logf("PONCHE: %s (puntaje %d)", best.Name, score)
		beepOK()
		go st.flush(cfg)
		time.Sleep(1500 * time.Millisecond) // dar tiempo a retirar el dedo
	}
}

func isConnErr(err error) bool {
	_, ok := err.(net.Error)
	if ok {
		return true
	}
	s := strings.ToLower(err.Error())
	for _, k := range []string{"websocket", "close", "eof", "reset", "broken pipe"} {
		if strings.Contains(s, k) {
			return true
		}
	}
	return false
}

func statusHandler(st *state) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		st.mu.Lock()
		defer st.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"version": version, "empleadosConHuella": len(st.templates), "ponchesPendientes": len(st.queue),
		})
	})
}

// startDetached lanza el servicio del lector (p. ej. fp-browser-service.exe de LIROX),
// que normalmente solo arranca al iniciar sesión. Así funciona sin sesión abierta.
func startDetached(command string) error {
	c := exec.Command(command)
	c.Dir = filepath.Dir(command)
	if err := c.Start(); err != nil {
		return err
	}
	go func() { _ = c.Wait() }()
	return nil
}

// ---------- Modo prueba ----------

func testReader(cfg *Config) {
	fmt.Println("\n== Prueba del lector ==")
	fmt.Print("1) Servidor Chronos... ")
	t, err := fetchTemplates(cfg)
	if err != nil {
		fmt.Println("FALLÓ:", err)
	} else {
		fmt.Printf("OK (%d empleados con huella registrada)\n", len(t))
	}

	fmt.Printf("2) Servicio del lector (%s)... ", cfg.ReaderURL)
	r, err := dialReader(cfg.ReaderURL)
	if err != nil {
		fmt.Println("FALLÓ:", err)
		fmt.Println("   -> Instale el driver/servicio web del 2Connect y verifique que esté corriendo.")
		return
	}
	defer r.Close()
	fmt.Println("OK")
	r.trace = func(s string) {
		if len(s) > 160 {
			s = s[:160] + "..."
		}
		fmt.Println("   [lector]", s)
	}

	fmt.Println("3) Ponga el dedo en el lector (60 segundos)...")
	captured, err := r.Capture(60*time.Second, nil)
	if err != nil {
		fmt.Println("   FALLÓ:", err)
		return
	}
	fmt.Println("   Huella capturada OK.")
	beepOK()
	if len(t) == 0 {
		fmt.Println("   (No hay huellas registradas para comparar. Registre empleados en el panel: Empleados > Editar > Lector USB 2Connect)")
		return
	}
	r.trace = nil
	best, score, err := r.Identify(captured, t)
	if err != nil {
		fmt.Println("   Error comparando:", err)
		return
	}
	if best != nil && score >= cfg.MatchThreshold {
		fmt.Printf("4) RECONOCIDO: %s (puntaje %d). La prueba NO registra ponche.\n", best.Name, score)
	} else {
		fmt.Printf("4) No reconocido (mejor puntaje %d, mínimo %d).\n", score, cfg.MatchThreshold)
	}
}
