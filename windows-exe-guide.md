# Guía para crear el archivo .exe (Aplicación de Windows) para Chronos Kiosco

Al convertir Chronos Kiosco en una aplicación nativa de escritorio usando **Electron**, rompemos las barreras de seguridad del navegador (como el bloqueo de conexiones locales desde HTTPS). Esto permitirá que la app se conecte libremente con el servicio de tu lector de huellas 2Connect (`ws://127.0.0.1:21187`).

Sigue estos pasos detallados para crear tu `.exe`:

### Requisitos Previos
1. Descarga e instala **Node.js** desde su página oficial: https://nodejs.org/ (Instala la versión LTS recomendada).
2. Abre la consola de tu PC (Presiona la tecla Windows, escribe **cmd** y dale Enter).

---

### Paso 1: Crear la carpeta del proyecto
En la consola de comandos (cmd), escribe los siguientes comandos uno por uno, presionando Enter después de cada uno:

```cmd
cd Desktop
mkdir ChronosKiosco
cd ChronosKiosco
npm init -y
```

### Paso 2: Instalar Electron
Ahora instalaremos las herramientas necesarias para construir la aplicación de Windows. Ejecuta este comando y espera a que termine (puede tardar un par de minutos):

```cmd
npm install electron electron-builder --save-dev
```

### Paso 3: Crear el archivo principal
Dentro de la carpeta `ChronosKiosco` que se creó en tu Escritorio, crea un nuevo archivo de texto y llámalo **`main.js`**. 
Ábrelo con el Bloc de notas o cualquier editor de código y pega exactamente esto:

```javascript
const { app, BrowserWindow } = require('electron');

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    autoHideMenuBar: true, // Ocultar el menú superior para que parezca Kiosco
    webPreferences: {
      webSecurity: false, // ¡ESTO ES LA CLAVE! Permite que tu app web se conecte al lector local por WebSockets
      allowRunningInsecureContent: true
    }
  });

  // Aquí ponemos la URL pública de tu Kiosco
  mainWindow.loadURL('https://ais-pre-wdqu7vmt3vygkynajfddna-82735450891.us-east5.run.app/kiosco');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```
*Guarda los cambios y cierra el archivo.*

### Paso 4: Configurar el empaquetador (package.json)
En la misma carpeta, hay un archivo llamado **`package.json`**. Ábrelo con el Bloc de notas y **reemplaza TODO** su contenido por esto:

```json
{
  "name": "chronos-kiosco",
  "version": "1.0.0",
  "description": "Kiosco de Asistencia",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --win --x64"
  },
  "build": {
    "appId": "com.tuempresa.kiosco",
    "productName": "Chronos Kiosco",
    "win": {
      "target": "nsis"
    }
  },
  "devDependencies": {
    "electron": "^28.2.0",
    "electron-builder": "^24.9.1"
  }
}
```
*Guarda y cierra el archivo.*

### Paso 5: ¡Generar el .exe!
Vuelve a la consola de comandos que tenías abierta (asegúrate de que sigues en la carpeta `ChronosKiosco`) y ejecuta:

```cmd
npm run build
```

Empezará a descargar algunas herramientas de Windows y empaquetará tu app. 
Cuando termine, dentro de tu carpeta `ChronosKiosco`, aparecerá una nueva carpeta llamada **`dist`**. 

Dentro de `dist` encontrarás tu archivo **`Chronos Kiosco Setup 1.0.0.exe`**. 

¡Felicidades! Ese es el instalador. Instálalo en la PC o tablet Windows que tiene el lector de huellas conectado.

### 💡 Nota Final sobre el lector
Asegúrate de que antes de abrir el Kiosco, hayas instalado el Driver de 2Connect en la PC y ejecutado el "Web SDK" o "Browser Service" (para que el WebSocket en el puerto `21187` esté en verde/activo). Al abrir tu nuevo programa `.exe`, dale a vincular huella y debería comunicarse perfectamente.
