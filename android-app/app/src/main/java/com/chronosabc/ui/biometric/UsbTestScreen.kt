package com.chronosabc.ui.biometric

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chronosabc.biometric.UsbFingerprintManager
import com.chronosabc.biometric.UsbState

@Composable
fun UsbTestScreen(
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val usbManager = remember { UsbFingerprintManager(context) }

    val state by usbManager.connectionState.collectAsState()

    DisposableEffect(usbManager) {
        // Al montar el composable escanea por dispositivos que ya pudieran estar conectados
        usbManager.scanForDevices()
        onDispose {
            usbManager.onDestroy()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Estado del Lector USB",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 24.dp, top = 24.dp)
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    color = when (state) {
                        is UsbState.Connected -> Color(0xFFE8F5E9) // Light Green
                        is UsbState.Error, is UsbState.PermissionDenied -> Color(0xFFFFEBEE) // Light Red
                        else -> Color(0xFFFFF3E0) // Light Orange
                    },
                    shape = RoundedCornerShape(12.dp)
                )
                .padding(24.dp)
        ) {
            Column {
                val statusTextStr = when (state) {
                    UsbState.NotDetected -> "Lector no detectado. Por favor, conecte el dispositivo USB."
                    is UsbState.RequestingPermission -> "Solicitando permiso USB a Android..."
                    UsbState.PermissionDenied -> "Permiso USB denegado. No se puede conectar al lector."
                    is UsbState.Connected -> "¡Lector conectado exitosamente!"
                    is UsbState.Error -> "Error: ${(state as UsbState.Error).message}"
                }

                Text(
                    text = statusTextStr,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.Black
                )
                
                if (state is UsbState.Connected) {
                    val connectedState = state as UsbState.Connected
                    Text(
                        text = "Nombre: ${connectedState.deviceName}",
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 16.dp)
                    )
                    Text(
                        text = "Vendor ID: ${connectedState.vendorId}",
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                    Text(
                        text = "Product ID: ${connectedState.productId}",
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                    Text(
                        text = "Interfaces detectadas: ${connectedState.interfacesCount}",
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
        }

        Button(
            onClick = {
                usbManager.scanForDevices()
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 32.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1976D2))
        ) {
            Text(text = "Reescanear Interfaces USB")
        }

        Button(
            onClick = onBack,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color.Gray)
        ) {
            Text(text = "Volver")
        }
    }
}
