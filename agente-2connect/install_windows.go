//go:build windows

package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unicode/utf16"
)

const (
	taskName   = "Chronos Agente 2Connect"
	installDir = `C:\ChronosAgente`
	exeName    = "agente-2connect.exe"
)

var (
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	procBeep = kernel32.NewProc("Beep")
)

func beep(freq, ms int) { _, _, _ = procBeep.Call(uintptr(freq), uintptr(ms)) }

func beepOK()   { beep(1800, 180) }
func beepFail() { beep(500, 250); beep(500, 250) }

func isAdmin() bool {
	return exec.Command("net", "session").Run() == nil
}

func relaunchAsAdmin(arg string) error {
	exe, _ := os.Executable()
	ps := fmt.Sprintf(`Start-Process -FilePath '%s' -ArgumentList '%s' -Verb RunAs`, strings.ReplaceAll(exe, "'", "''"), arg)
	return exec.Command("powershell", "-NoProfile", "-Command", ps).Run()
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func run(name string, args ...string) (string, error) {
	out, err := exec.Command(name, args...).CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

const taskXML = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Lee el lector de huellas 2Connect y envia los ponches a Chronos.</Description></RegistrationInfo>
  <Triggers>
    <BootTrigger><Enabled>true</Enabled><Delay>PT20S</Delay></BootTrigger>
    <LogonTrigger><Enabled>true</Enabled></LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author"><UserId>S-1-5-18</UserId><RunLevel>HighestAvailable</RunLevel></Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings><StopOnIdleEnd>false</StopOnIdleEnd><RestartOnIdle>false</RestartOnIdle></IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>5</Priority>
    <RestartOnFailure><Interval>PT1M</Interval><Count>999</Count></RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec><Command>%s</Command><Arguments>servicio</Arguments><WorkingDirectory>%s</WorkingDirectory></Exec>
  </Actions>
</Task>`

func writeUTF16(path, s string) error {
	u := utf16.Encode([]rune(strings.ReplaceAll(s, "\n", "\r\n")))
	b := make([]byte, 2+len(u)*2)
	b[0], b[1] = 0xFF, 0xFE
	for i, c := range u {
		b[2+i*2] = byte(c)
		b[3+i*2] = byte(c >> 8)
	}
	return os.WriteFile(path, b, 0644)
}

func install() error {
	if !isAdmin() {
		fmt.Println("Se necesitan permisos de administrador. Acepte la ventana de Windows que aparecerá...")
		return relaunchAsAdmin("instalar")
	}

	fmt.Println("Deteniendo versión anterior (si existe)...")
	_, _ = run("schtasks", "/End", "/TN", taskName)

	if err := os.MkdirAll(installDir, 0755); err != nil {
		return err
	}
	src, _ := os.Executable()
	dst := filepath.Join(installDir, exeName)
	if !strings.EqualFold(filepath.Clean(src), filepath.Clean(dst)) {
		fmt.Println("Copiando programa a", installDir)
		if err := copyFile(src, dst); err != nil {
			return fmt.Errorf("no se pudo copiar el programa: %w", err)
		}
		if err := copyFile(configPath(), filepath.Join(installDir, "config.json")); err != nil {
			return fmt.Errorf("no se pudo copiar config.json: %w", err)
		}
	}

	xmlPath := filepath.Join(installDir, "tarea.xml")
	if err := writeUTF16(xmlPath, fmt.Sprintf(taskXML, dst, installDir)); err != nil {
		return err
	}
	if out, err := run("schtasks", "/Create", "/TN", taskName, "/XML", xmlPath, "/F"); err != nil {
		return fmt.Errorf("no se pudo crear la tarea programada: %s", out)
	}
	_ = os.Remove(xmlPath)

	fmt.Println("Ajustando energía: la PC no se suspenderá (la pantalla sí puede apagarse)...")
	_, _ = run("powercfg", "/change", "standby-timeout-ac", "0")
	_, _ = run("powercfg", "/change", "hibernate-timeout-ac", "0")

	if out, err := run("schtasks", "/Run", "/TN", taskName); err != nil {
		return fmt.Errorf("tarea creada pero no arrancó: %s", out)
	}
	fmt.Println("\nLISTO. El agente quedó corriendo en segundo plano y arrancará solo cada vez que se encienda la PC.")
	fmt.Println("Registro de actividad:", filepath.Join(installDir, "agente.log"))
	return nil
}

func uninstall() error {
	if !isAdmin() {
		fmt.Println("Se necesitan permisos de administrador. Acepte la ventana de Windows que aparecerá...")
		return relaunchAsAdmin("desinstalar")
	}
	_, _ = run("schtasks", "/End", "/TN", taskName)
	if out, err := run("schtasks", "/Delete", "/TN", taskName, "/F"); err != nil {
		return fmt.Errorf("%s", out)
	}
	fmt.Println("Desinstalado. (Los archivos quedan en", installDir, "y puede borrarlos a mano.)")
	return nil
}
