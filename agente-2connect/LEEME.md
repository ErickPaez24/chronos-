# Agente Chronos 2Connect (Windows, sin pantalla)

Programa único `agente-2connect.exe` que deja la PC funcionando como **reloj de ponche**:
la persona pone el dedo en el lector USB 2Connect, suena un **bip** y el ponche llega a Chronos.
No hace falta monitor, navegador, Kiosco ni que nadie inicie sesión.

Descarga: [`dist/agente-2connect.exe`](dist/agente-2connect.exe)

## Qué hace
- Al encender la PC arranca solo (tarea programada de Windows como SYSTEM).
- Descarga del servidor las huellas registradas (cada 5 min) y las guarda localmente.
- Espera huellas sin parar, identifica al empleado y envía el ponche (ENTRADA/SALIDA según el orden del día).
- **Sin internet:** sigue reconociendo y guarda los ponches en `pendientes.json`; los envía cuando vuelve la conexión.
- Bip agudo = ponche OK. Dos bips graves = huella no reconocida.
- Ignora si la misma persona pone el dedo otra vez en menos de 60 s.

## Instalación en la PC nueva (una sola vez)
1. **Servidor:** en las variables del servidor Chronos debe existir `CLOCK_API_KEY` (una clave larga inventada por usted).
2. **Driver 2Connect:** instale el driver y el servicio web del lector (el que abre `ws://127.0.0.1:21187`), el mismo que se usa para registrar huellas en el panel.
3. Copie `agente-2connect.exe` a la PC y haga doble clic:
   - Opción **1 – Configurar:** URL del servidor Chronos y la clave `CLOCK_API_KEY`.
   - Opción **2 – Probar el lector:** ponga el dedo; debe decir `RECONOCIDO: <nombre>`. (No registra ponche.)
   - Opción **3 – INSTALAR:** pide permiso de administrador, copia todo a `C:\ChronosAgente` y lo deja corriendo.
4. Listo. Puede apagar el monitor.

## Para que funcione “sin prender nada”
- **BIOS:** active *Restore on AC Power Loss = Power On* (o *After Power Failure = On*). Así, si se va la luz, la PC enciende sola.
- El instalador ya desactiva la suspensión de Windows (el monitor sí puede apagarse).
- Si el servicio web del 2Connect **no** es un servicio de Windows sino un programa con ícono en la barra de tareas,
  active el **inicio de sesión automático** de Windows (`netplwiz` → desmarcar “Los usuarios deben escribir su nombre…”)
  y deje ese programa en Inicio. También puede poner su ruta en `readerStartCommand` del `config.json`.

## Registrar huellas de empleados
Igual que antes: Panel → Empleados → Editar → **Lector USB 2Connect** (desde una PC con el lector y el servicio).
El agente toma las huellas nuevas en máximo 5 minutos.

## Archivos en `C:\ChronosAgente`
| Archivo | Para qué |
|---|---|
| `config.json` | URL del servidor, clave, puntaje mínimo (`matchThreshold`, 60 por defecto) |
| `agente.log` | Registro de todo lo que pasa (ponches, errores) |
| `plantillas.json` | Copia local de las huellas (para funcionar sin internet) |
| `pendientes.json` | Ponches aún no enviados |

Estado rápido en la misma PC: abrir `http://127.0.0.1:47321`.

## Comandos
`agente-2connect.exe instalar | desinstalar | probar | configurar | servicio`

## Compilar
```bash
cd agente-2connect && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o dist/agente-2connect.exe .
```
