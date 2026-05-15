# Guía para crear la APK del Kiosco en Android Studio

Para solucionar el problema de WebAuthn y las "llaves de acceso" (Passkeys) en las tablets o teléfonos Android compartidos, la mejor opción es crear un **WebView Nativo** que inyecte una interfaz JavaScript. De este modo, la aplicación web podrá llamar directamente al sensor de huellas nativo de Android (`androidx.biometric:biometric`) sin pasar por el navegador general.

## Instrucciones paso a paso en Android Studio

### 1. Crear el proyecto y agregar dependencias
1. Abre Android Studio y crea un nuevo proyecto **Empty Views Activity** (o "Empty Activity" si no aparece la otra, pero asegúrate de no elegir la plantilla de Compose pura si vas a usar WebView más fácil).
2. Abre tu archivo `build.gradle.kts` (Module :app) y asegúrate de tener estas dos dependencias en el bloque `dependencies`:

```kotlin
implementation("androidx.appcompat:appcompat:1.6.1") // <-- NECESARIO PARA AppCompatActivity
implementation("androidx.biometric:biometric:1.1.0") // <-- PARA LA HUELLA
```

3. Sincroniza el proyecto pulsando **Sync Now**.

### 2. Permisos
En el archivo `AndroidManifest.xml` (en app > src > main), agrega los siguientes permisos arriba de la etiqueta `<application>`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
```

### 3. El código
Reemplaza TODO el contenido de tu `MainActivity.kt` por lo siguiente. **Asegúrate de que la primera línea sea exactamente `package com.example.kiosko`**.

Este nuevo código corrige dos errores comunes por los que la app se cierra sola (Problemas de Tema en Android y problemas del Hilo Principal al llamar a la huella).

Copia desde la palabra `package` hasta la última llave `}`, **sin copiar los ``` del final**.

```kotlin
package com.example.kiosko

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.fragment.app.FragmentActivity
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat

class MainActivity : FragmentActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
        }

        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

        webView.addJavascriptInterface(WebAppInterface(this, webView), "AndroidAuth")

        // URL COMPLETA DEL KIOSCO EN TU APLICACIÓN:
        webView.loadUrl("https://ais-pre-wdqu7vmt3vygkynajfddna-82735450891.us-east5.run.app/kiosco") 
    }

    class WebAppInterface(private val activity: FragmentActivity, private val webView: WebView) {

        @JavascriptInterface
        fun authenticate(userId: String) {
            // TODO DEBE IR DENTRO DE runOnUiThread PORQUE ES UNA ACCIÓN VISUAL (UI)
            activity.runOnUiThread {
                val executor = ContextCompat.getMainExecutor(activity)
                val biometricPrompt = BiometricPrompt(activity, executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            super.onAuthenticationError(errorCode, errString)
                            webView.evaluateJavascript("javascript:onBiometricResult('$userId', false, '$errString')", null)
                        }

                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            super.onAuthenticationSucceeded(result)
                            webView.evaluateJavascript("javascript:onBiometricResult('$userId', true, '')", null)
                        }

                        override fun onAuthenticationFailed() {
                            super.onAuthenticationFailed()
                            webView.evaluateJavascript("javascript:onBiometricResult('$userId', false, 'Huella no reconocida')", null)
                        }
                    })

                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Autenticación Requerida")
                    .setSubtitle("Confirma tu huella")
                    .setNegativeButtonText("Cancelar")
                    .build()

                biometricPrompt.authenticate(promptInfo)
            }
        }
    }
}
```

## Limitación de Tablets Compartidas & Android
El diálogo nativo de huellas de Android valida **cualquier huella** registrada en la configuración del dispositivo. No sabe diferenciar *a quién* pertenece ese dedo específicamente.

Es decir, si tienes 5 personas en el sistema, tendrás que registrar los dedos de las 5 personas en la Configuración de Android de esa tablet. Siempre que uno de los 5 presione la pantalla después de poner su ID, el sistema Android dirá "Identidad validada". Si la empresa tiene buena convivencia, basta con este mecanismo porque se requiere saber el ID del compañero y tener acceso físico. Si quieres un mayor control, deberías instalar un lector USB de huellas dedicado, lo cual requeriría un SDK de terceros en vez de `androidx.biometric`.
