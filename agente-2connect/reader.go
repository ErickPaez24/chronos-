package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

// Mensajes del servicio local 2Connect (mismo protocolo que usa el Kiosco web):
//
//	workmsg 1 = conecte el lector, 2 = ponga el dedo, 3 = levante el dedo,
//	workmsg 5 = resultado de captura (retmsg 1 = ok, data1 = plantilla),
//	workmsg 6 = resultado de registro, workmsg 9 = resultado de comparación (retmsg = puntaje).
type readerMsg struct {
	WorkMsg int
	RetMsg  int
	Data1   string
	Raw     string
}

func toInt(v any) int {
	switch x := v.(type) {
	case float64:
		return int(x)
	case string:
		n, _ := strconv.Atoi(strings.TrimSpace(x))
		return n
	case bool:
		if x {
			return 1
		}
	}
	return 0
}

func parseReaderMsg(b []byte) (readerMsg, error) {
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		return readerMsg{Raw: string(b)}, err
	}
	get := func(k string) any {
		for key, v := range m {
			if strings.EqualFold(key, k) {
				return v
			}
		}
		return nil
	}
	d1, _ := get("data1").(string)
	return readerMsg{WorkMsg: toInt(get("workmsg")), RetMsg: toInt(get("retmsg")), Data1: d1, Raw: string(b)}, nil
}

type Reader struct {
	conn  *websocket.Conn
	trace func(string) // opcional: imprime todo lo recibido (modo prueba)
}

var errNoFinger = errors.New("tiempo agotado esperando el dedo")

func dialReader(url string) (*Reader, error) {
	d := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
	c, _, err := d.Dial(url, nil)
	if err != nil {
		return nil, err
	}
	return &Reader{conn: c}, nil
}

func (r *Reader) Close() { _ = r.conn.Close() }

func (r *Reader) send(cmd, d1, d2 string) error {
	_ = r.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	return r.conn.WriteJSON(map[string]string{"cmd": cmd, "data1": d1, "data2": d2})
}

// waitFor lee mensajes hasta recibir el workmsg indicado.
func (r *Reader) waitFor(workmsg int, timeout time.Duration, onOther func(readerMsg)) (readerMsg, error) {
	deadline := time.Now().Add(timeout)
	for {
		_ = r.conn.SetReadDeadline(deadline)
		_, b, err := r.conn.ReadMessage()
		if err != nil {
			var ne interface{ Timeout() bool }
			if errors.As(err, &ne) && ne.Timeout() {
				return readerMsg{}, errNoFinger
			}
			return readerMsg{}, err
		}
		m, perr := parseReaderMsg(b)
		if r.trace != nil {
			r.trace(m.Raw)
		}
		if perr != nil {
			continue
		}
		if m.WorkMsg == workmsg {
			return m, nil
		}
		if onOther != nil {
			onOther(m)
		}
	}
}

// Capture espera a que pongan un dedo y devuelve la plantilla capturada.
func (r *Reader) Capture(timeout time.Duration, onOther func(readerMsg)) (string, error) {
	if err := r.send("capture", "1", "0"); err != nil {
		return "", err
	}
	m, err := r.waitFor(5, timeout, onOther)
	if err != nil {
		return "", err
	}
	if m.RetMsg != 1 || m.Data1 == "" || m.Data1 == "null" {
		return "", fmt.Errorf("captura fallida (retmsg=%d)", m.RetMsg)
	}
	return m.Data1, nil
}

// Match compara dos plantillas y devuelve el puntaje (0-100 aprox.).
func (r *Reader) Match(registered, captured string) (int, error) {
	if err := r.send("match", registered, captured); err != nil {
		return 0, err
	}
	m, err := r.waitFor(9, 10*time.Second, nil)
	if err != nil {
		return 0, err
	}
	return m.RetMsg, nil
}

type Template struct {
	UserID   string `json:"userId"`
	Name     string `json:"name"`
	Template string `json:"template"`
}

// Identify busca la plantilla con mayor puntaje (1:N).
func (r *Reader) Identify(captured string, list []Template) (best *Template, score int, err error) {
	for i := range list {
		s, err := r.Match(list[i].Template, captured)
		if err != nil {
			return nil, 0, err
		}
		if s > score {
			score, best = s, &list[i]
		}
	}
	return best, score, nil
}
