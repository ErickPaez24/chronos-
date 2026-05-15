package com.chronosabc.biometric

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Se encarga de gestionar la conexión USB OTG para el lector de huellas 2C-LDH808 o similares.
 * Esta clase detecta la inserción del dispositivo, solicita permisos e intenta establecer la conexión.
 */
class UsbFingerprintManager(private val context: Context) {

    private val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager

    private val _connectionState = MutableStateFlow<UsbState>(UsbState.NotDetected)
    val connectionState: StateFlow<UsbState> = _connectionState.asStateFlow()

    private var usbConnection: UsbDeviceConnection? = null
    private var usbDevice: UsbDevice? = null

    // Action para solicitar permisos
    private val ACTION_USB_PERMISSION = "com.chronosabc.USB_PERMISSION"

    // BroadcastReceiver para capturar eventos USB
    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val action = intent?.action
            val device: UsbDevice? = intent?.getParcelableExtra(UsbManager.EXTRA_DEVICE)
            
            Log.d(TAG, "BroadcastReceiver action: $action")

            if (ACTION_USB_PERMISSION == action) {
                synchronized(this) {
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                        device?.let {
                            Log.d(TAG, "Permiso USB concedido para ${it.deviceName}")
                            connectToDevice(it)
                        }
                    } else {
                        Log.e(TAG, "Permiso USB denegado para el dispositivo")
                        _connectionState.value = UsbState.PermissionDenied
                    }
                }
            } else if (UsbManager.ACTION_USB_DEVICE_ATTACHED == action) {
                device?.let {
                    Log.d(TAG, "Dispositivo USB detectado: ${it.deviceName}")
                    handleUsbDevice(it)
                }
            } else if (UsbManager.ACTION_USB_DEVICE_DETACHED == action) {
                device?.let {
                    if (it == usbDevice) {
                        Log.d(TAG, "Dispositivo USB desconectado")
                        disconnect()
                    }
                }
            }
        }
    }

    init {
        // Registrar el BroadcastReceiver para permisos y cambios USB
        val filter = IntentFilter(ACTION_USB_PERMISSION).apply {
            addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(usbReceiver, filter)
        }
    }

    /**
     * Inicia la búsqueda de dispositivos conectados.
     */
    fun scanForDevices() {
        val deviceList = usbManager.deviceList
        if (deviceList.isEmpty()) {
            Log.d(TAG, "No se detectaron dispositivos USB conectados.")
            _connectionState.value = UsbState.NotDetected
            return
        }

        for (device in deviceList.values) {
            Log.d(TAG, "Encontrado dispositivo USB:")
            Log.d(TAG, "Vendor ID: ${device.vendorId}")
            Log.d(TAG, "Product ID: ${device.productId}")
            Log.d(TAG, "Device Name: ${device.deviceName}")
            
            // Aquí se puede agregar una validación específica por Vendor ID y Product ID
            // EJ: if (device.vendorId == 0xXXXX && device.productId == 0xXXXX)
            // Por simplicidad en este ejemplo, tratamos de conectarnos al primero (o lo personalizas).
            handleUsbDevice(device)
            break // Detiene en el primer dispositivo. Ajusta si hay otros periféricos.
        }
    }

    private fun handleUsbDevice(device: UsbDevice) {
        if (usbManager.hasPermission(device)) {
            connectToDevice(device)
        } else {
            Log.d(TAG, "Solicitando permisos para el dispositivo USB...")
            _connectionState.value = UsbState.RequestingPermission(device)
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val permissionIntent = PendingIntent.getBroadcast(context, 0, Intent(ACTION_USB_PERMISSION), flags)
            usbManager.requestPermission(device, permissionIntent)
        }
    }

    private fun connectToDevice(device: UsbDevice) {
        try {
            usbConnection = usbManager.openDevice(device)
            if (usbConnection != null) {
                usbDevice = device
                Log.d(TAG, "Conectado exitosamente al dispositivo.")
                logDeviceInterfaces(device)
                
                // NOTA IMPORTANTE PARA INTEGRACIÓN DE SDK:
                // Si tienes un SDK externo (archivos .aar o .jar), aquí es donde normalmente
                // pasas la instancia de `usbManager` o `usbDevice` al SDK para su inicialización.
                // Ejemplo: ThirdPartyFingerprintSDK.init(context, usbManager, device)

                _connectionState.value = UsbState.Connected(
                    vendorId = device.vendorId,
                    productId = device.productId,
                    deviceName = device.deviceName,
                    interfacesCount = device.interfaceCount
                )
            } else {
                Log.e(TAG, "No se pudo abrir conexión con el dispositivo. Retornó null.")
                _connectionState.value = UsbState.Error("Fallo al abrir la conexión USB")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error conectando al dispositivo: ${e.message}", e)
            _connectionState.value = UsbState.Error(e.message ?: "Error desconocido")
        }
    }

    private fun logDeviceInterfaces(device: UsbDevice) {
        Log.d(TAG, "Interfaces detectadas: ${device.interfaceCount}")
        for (i in 0 until device.interfaceCount) {
            val endpointCount = device.getInterface(i).endpointCount
            Log.d(TAG, " - Interface $i tiene $endpointCount endpoints")
        }
    }

    fun disconnect() {
        Log.d(TAG, "Cerrando conexión USB y liberando recursos.")
        usbConnection?.close()
        usbConnection = null
        usbDevice = null
        _connectionState.value = UsbState.NotDetected
    }

    fun onDestroy() {
        disconnect()
        try {
            context.unregisterReceiver(usbReceiver)
        } catch (e: Exception) {
            Log.e(TAG, "Error al quitar registro de usbReceiver: ${e.message}")
        }
    }

    companion object {
        const val TAG = "UsbFingerprintManager"
    }
}

/**
 * Estados posibles del manejador USB
 */
sealed class UsbState {
    object NotDetected : UsbState()
    data class RequestingPermission(val device: UsbDevice) : UsbState()
    object PermissionDenied : UsbState()
    data class Connected(
        val vendorId: Int,
        val productId: Int,
        val deviceName: String,
        val interfacesCount: Int
    ) : UsbState()
    data class Error(val message: String) : UsbState()
}
