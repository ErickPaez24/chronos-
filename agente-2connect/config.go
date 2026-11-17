package main

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct {
	ServerURL          string `json:"serverUrl"`
	APIKey             string `json:"apiKey"`
	ReaderURL          string `json:"readerUrl"`
	DeviceName         string `json:"deviceName"`
	MatchThreshold     int    `json:"matchThreshold"`
	CooldownSeconds    int    `json:"cooldownSeconds"`
	RefreshMinutes     int    `json:"refreshTemplatesMinutes"`
	Beep               bool   `json:"beep"`
	ReaderStartCommand string `json:"readerStartCommand"`
}

func defaultConfig() *Config {
	return &Config{
		ServerURL:       "",
		ReaderURL:       "ws://127.0.0.1:21187/fps",
		DeviceName:      "lector2connect",
		MatchThreshold:  60,
		CooldownSeconds: 60,
		RefreshMinutes:  5,
		Beep:            true,
	}
}

// baseDir: carpeta donde está el .exe (config, log y cola viven al lado).
func baseDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	if p, err := filepath.EvalSymlinks(exe); err == nil {
		exe = p
	}
	return filepath.Dir(exe)
}

func configPath() string { return filepath.Join(baseDir(), "config.json") }

func loadConfig() (*Config, error) {
	cfg := defaultConfig()
	b, err := os.ReadFile(configPath())
	if err != nil {
		return cfg, err
	}
	if err := json.Unmarshal(b, cfg); err != nil {
		return cfg, fmt.Errorf("config.json inválido: %w", err)
	}
	if cfg.ReaderURL == "" {
		cfg.ReaderURL = defaultConfig().ReaderURL
	}
	if cfg.MatchThreshold <= 0 {
		cfg.MatchThreshold = 60
	}
	if cfg.RefreshMinutes <= 0 {
		cfg.RefreshMinutes = 5
	}
	if cfg.DeviceName == "" {
		cfg.DeviceName = "lector2connect"
	}
	cfg.ServerURL = strings.TrimRight(strings.TrimSpace(cfg.ServerURL), "/")
	return cfg, nil
}

func (c *Config) valid() error {
	if c.ServerURL == "" {
		return fmt.Errorf("falta serverUrl")
	}
	if u, err := url.Parse(c.ServerURL); err != nil || (u.Scheme != "https" && u.Scheme != "http") {
		return fmt.Errorf("serverUrl inválida: %s", c.ServerURL)
	}
	if c.APIKey == "" {
		return fmt.Errorf("falta apiKey (la misma CLOCK_API_KEY del servidor)")
	}
	return nil
}

func saveConfig(c *Config) error {
	b, _ := json.MarshalIndent(c, "", "  ")
	return os.WriteFile(configPath(), b, 0600)
}

// mustConfig carga la configuración; si falta algo y es interactivo, la pide.
func mustConfig(interactive bool) *Config {
	cfg, _ := loadConfig()
	if cfg.valid() == nil {
		return cfg
	}
	if !interactive {
		logf("Configuración incompleta (%v). Ejecute el programa y elija 'Configurar'.", cfg.valid())
		os.Exit(2)
	}
	return askConfig(cfg)
}

func ask(label, current string) string {
	if current != "" {
		fmt.Printf("%s [%s]: ", label, current)
	} else {
		fmt.Printf("%s: ", label)
	}
	v := readLine()
	if v == "" {
		return current
	}
	return v
}

func askConfig(cfg *Config) *Config {
	fmt.Println("\n== Configuración ==  (Enter = dejar el valor actual)")
	for {
		cfg.ServerURL = strings.TrimRight(ask("URL del servidor Chronos (ej. https://mi-chronos.run.app)", cfg.ServerURL), "/")
		cfg.APIKey = ask("Clave del agente (CLOCK_API_KEY del servidor)", cfg.APIKey)
		cfg.ReaderURL = ask("Dirección del servicio 2Connect", cfg.ReaderURL)
		cfg.DeviceName = ask("Nombre de este lector", cfg.DeviceName)
		if t, err := strconv.Atoi(ask("Puntaje mínimo para aceptar la huella", strconv.Itoa(cfg.MatchThreshold))); err == nil && t > 0 {
			cfg.MatchThreshold = t
		}
		if err := cfg.valid(); err != nil {
			fmt.Println("  ->", err, "- intente de nuevo.")
			continue
		}
		break
	}
	if err := saveConfig(cfg); err != nil {
		fmt.Println("No se pudo guardar config.json:", err)
	} else {
		fmt.Println("Guardado en", configPath())
	}
	return cfg
}
