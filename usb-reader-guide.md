# Guía para conectar Lectores USB Externos (Marca 2Connect, ZKTeco, SecuGen) a una App Web

El lector 2Connect que tienes es un dispositivo de hardware USB (como un ratón o teclado). Sin embargo, Google Chrome o cualquier otro navegador web **no puede leer directamente los datos de la huella USB por seguridad y privacidad** (las APIs web nativas como `WebAuthn` están diseñadas para lectores que el sistema operativo ya controla, como Windows Hello en la propia PC o TouchID en Android/Mac).

Para que **Chronos ABC** (en la web) pueda utilizar tu lector específico **2Connect**, debes usar el **Web SDK de 2Connect/ZkFinger**.

### ¿Cómo funciona la arquitectura?
1. **Instalación:** Necesitas instalar los Drivers de Windows que vinieron en disco/enlace de tu lector 2Connect.
2. **Servicio Local:** Además del driver, debes correr un pequeño programa proporcionado por 2Connect llamado *Web SDK* o *Local Bridge*. Este programa actúa como un "traductor". Se queda ejecutándose en segundo plano en Windows y levanta un pequeño servidor local (por ejemplo `http://localhost:8080` o por WebSockets `ws://127.0.0.1:8080`).
3. **App Web:** Chronos ABC hace peticiones (`fetch` o `WebSocket`) directamente a esa dirección local para preguntarle: *"¿Hay alguna huella tocando el lector?"*

### Pasos siguientes
- Como desarrollador de la app, he integrado en la pestaña de **Empleados -> Editar** un botón verde llamado **"Lector USB 2Connect"**.
- Al presionar ese botón, la aplicación intentará escanear la huella asumiendo que este servicio está corriendo.
- Por default, he agregado un botón de **Simulación (Dev)** para que veas el flujo lógico.
- Para integrarlo 100% en vivo, necesitas el manual de desarrollo web (Web SDK) que incluye tu lector 2Connect para revisar exactamente a qué dirección / puerto de `localhost` debe conectarse la aplicación web y qué JSON enviar para registrarla.

### ¿Aún no tienes el SDK web del 2connect o prefieres sin drivers extra?
Puedes utilizar tu celular o tablet (que usa huellas Android nativas) y la plataforma **WebAuthn** nativa, o utilizar nuestra app Android (descargable). La vinculación en Android funciona automáticamente con el dedo del usuario sin importar marcas de lectores y no requiere configuración portuaria local ya que está vinculada directamente al sistema de Biometría de Android (tal como lo construimos en el visor).
