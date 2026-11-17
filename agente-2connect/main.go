// Agente Chronos 2Connect
//
// Programa para Windows que corre en segundo plano (sin pantalla, sin sesión
// abierta) en la PC que tiene conectado el lector de huellas USB 2Connect.
//
//   - Descarga del servidor Chronos las huellas registradas de los empleados.
//   - Espera continuamente que alguien ponga el dedo en el lector.
//   - Identifica al empleado (1:N) y envía el ponche al servidor.
//   - Si no hay internet, guarda los ponches y los reenvía después.
//
// Se comunica con el lector a través del servicio local de 2Connect
// (WebSocket ws://127.0.0.1:21187/fps), el mismo que usa el Kiosco web.
package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

const version = "1.0.0"

func main() {
	cmd := ""
	if len(os.Args) > 1 {
		cmd = strings.ToLower(strings.TrimLeft(os.Args[1], "-/"))
	}

	switch cmd {
	case "servicio", "run":
		runAgent()
	case "probar", "test":
		cfg := mustConfig(true)
		testReader(cfg)
		pause()
	case "instalar", "install":
		mustConfig(true)
		if err := install(); err != nil {
			fmt.Println("ERROR:", err)
		}
		pause()
	case "desinstalar", "uninstall":
		if err := uninstall(); err != nil {
			fmt.Println("ERROR:", err)
		}
		pause()
	case "configurar", "config":
		cfg, _ := loadConfig()
		askConfig(cfg)
		pause()
	case "":
		menu()
	default:
		fmt.Println("Uso: agente-2connect.exe [instalar | desinstalar | probar | configurar | servicio]")
	}
}

func menu() {
	fmt.Printf("\n  CHRONOS - Agente lector de huellas 2Connect  v%s\n", version)
	fmt.Println("  ------------------------------------------------")
	fmt.Println("  1) Configurar (URL del servidor y clave)")
	fmt.Println("  2) Probar el lector (poner el dedo una vez)")
	fmt.Println("  3) INSTALAR: arrancar solo al encender la PC")
	fmt.Println("  4) Desinstalar")
	fmt.Println("  5) Ejecutar aquí mismo (ver ponches en vivo)")
	fmt.Println("  0) Salir")
	fmt.Print("\n  Opción: ")
	switch readLine() {
	case "1":
		cfg, _ := loadConfig()
		askConfig(cfg)
	case "2":
		testReader(mustConfig(true))
	case "3":
		mustConfig(true)
		if err := install(); err != nil {
			fmt.Println("ERROR:", err)
		}
	case "4":
		if err := uninstall(); err != nil {
			fmt.Println("ERROR:", err)
		}
	case "5":
		logToConsole = true
		runAgent()
	default:
		return
	}
	pause()
}

var stdin = bufio.NewReader(os.Stdin)

func readLine() string {
	s, _ := stdin.ReadString('\n')
	return strings.TrimSpace(s)
}

func pause() {
	fmt.Print("\nPresione Enter para cerrar...")
	readLine()
}
