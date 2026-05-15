package com.chronosabc.ui.login

import android.app.Application
import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.rounded.Fingerprint
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.chronosabc.biometric.BiometricHelper
import com.chronosabc.data.repository.AuthRepository
import com.chronosabc.data.repository.UserRepository
import com.chronosabc.ui.pin.PinDialog
import kotlinx.coroutines.launch

class LoginViewModel(app: Application) : AndroidViewModel(app) {
    private val authRepo = AuthRepository(app)
    private val userRepo = UserRepository(app)

    var username by mutableStateOf("")
    var password by mutableStateOf("")
    var errorMessage by mutableStateOf<String?>(null)
    var loading by mutableStateOf(false)

    // para huella / PIN
    var lastUserIdForBiometric by mutableStateOf<Long?>(null)
    var biometricFailures by mutableStateOf(0)
    var showPinDialog by mutableStateOf(false)

    fun loginWithPassword(onAdmin: () -> Unit, onUser: () -> Unit) {
        viewModelScope.launch {
            loading = true
            errorMessage = null
            try {
                if (username.trim().isEmpty() || password.isEmpty()) {
                    errorMessage = "Por favor, completa todos los campos"
                    return@launch
                }
                
                val userId = authRepo.loginWithPassword(username.trim(), password)
                if (userId == null) {
                    errorMessage = "Usuario o contraseña incorrectos"
                    authRepo.logAuth(null, "PASSWORD", "FAILURE", "WRONG_PASSWORD")
                    return@launch
                }
                val user = userRepo.getUserById(userId)
                if (user == null || !user.isActive) {
                    errorMessage = "Usuario inactivo o no encontrado"
                    authRepo.logAuth(userId, "PASSWORD", "FAILURE", "INACTIVE_USER")
                    return@launch
                }
                authRepo.logAuth(user.id, "PASSWORD", "SUCCESS", null)
                if (user.role == "ADMIN") onAdmin() else onUser()
            } finally {
                loading = false
            }
        }
    }

    fun onBiometricSuccess(onAdmin: () -> Unit, onUser: () -> Unit) {
        viewModelScope.launch {
            val user = userRepo.getUserByUsername(username.trim()) ?: run {
                errorMessage = "El usuario '${username.trim()}' no existe"
                return@launch
            }
            if (!user.isActive) {
                errorMessage = "El usuario está inactivo"
                return@launch
            }
            lastUserIdForBiometric = user.id
            biometricFailures = 0
            errorMessage = null
            authRepo.logAuth(user.id, "BIOMETRIC", "SUCCESS", null)
            if (user.role == "ADMIN") onAdmin() else onUser()
        }
    }

    fun onBiometricFailure(message: String, onNeedPin: () -> Unit) {
        viewModelScope.launch {
            if (message == "BIOMETRIC_FAILED_3_TIMES") {
                biometricFailures = 3
                showPinDialog = true
                lastUserIdForBiometric = userRepo.getUserByUsername(username.trim())?.id
                authRepo.logAuth(lastUserIdForBiometric, "BIOMETRIC", "LOCKED_OUT", "BIOMETRIC_FAILED_3_TIMES")
                onNeedPin()
            } else {
                biometricFailures += 1
                errorMessage = message
                authRepo.logAuth(lastUserIdForBiometric, "BIOMETRIC", "FAILURE", message)
            }
        }
    }

    fun verifyPinAndLogin(pin: String, onAdmin: () -> Unit, onUser: () -> Unit) {
        viewModelScope.launch {
            loading = true
            errorMessage = null
            try {
                val userId = lastUserIdForBiometric
                    ?: userRepo.getUserByUsername(username.trim())?.id
                if (userId == null) {
                    errorMessage = "Usuario no encontrado"
                    return@launch
                }
                val ok = authRepo.verifyPin(userId, pin)
                if (!ok) {
                    errorMessage = "PIN incorrecto"
                    authRepo.logAuth(userId, "PIN", "FAILURE", "WRONG_PIN")
                    return@launch
                }
                val user = userRepo.getUserById(userId)
                if (user == null || !user.isActive) {
                    errorMessage = "Usuario inactivo o no encontrado"
                    authRepo.logAuth(userId, "PIN", "FAILURE", "INACTIVE_USER")
                    return@launch
                }
                authRepo.logAuth(user.id, "PIN", "SUCCESS", null)
                showPinDialog = false
                if (user.role == "ADMIN") onAdmin() else onUser()
            } finally {
                loading = false
            }
        }
    }
}

@Composable
fun LoginScreen(
    onAdminLogin: () -> Unit,
    onUserLogin: () -> Unit,
    onUsbTest: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as ComponentActivity
    val vm = remember { LoginViewModel(context.applicationContext as Application) }

    var pinInput by remember { mutableStateOf("") }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Box(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Card(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                shape = RoundedCornerShape(24.dp)
            ) {
                Column(
                    modifier = Modifier.padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Chronos ABC",
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(32.dp))

                    OutlinedTextField(
                        value = vm.username,
                        onValueChange = { vm.username = it },
                        label = { Text("Usuario") },
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = "Usuario") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    OutlinedTextField(
                        value = vm.password,
                        onValueChange = { vm.password = it },
                        label = { Text("Contraseña") },
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = "Contraseña") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
                    Spacer(modifier = Modifier.height(24.dp))

                    if (vm.errorMessage != null) {
                        Text(
                            text = vm.errorMessage ?: "",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(bottom = 16.dp)
                        )
                    }

                    Button(
                        onClick = { vm.loginWithPassword(onAdminLogin, onUserLogin) },
                        enabled = !vm.loading,
                        modifier = Modifier.fillMaxWidth().height(50.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Iniciar Sesión", fontSize = MaterialTheme.typography.titleMedium.fontSize)
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                    
                    Divider(modifier = Modifier.fillMaxWidth(0.5f), color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f))
                    
                    Spacer(modifier = Modifier.height(24.dp))

                    val biometricHelper = remember {
                        BiometricHelper(
                            activity as FragmentActivity,
                            onSuccess = {
                                vm.onBiometricSuccess(onAdminLogin, onUserLogin)
                            },
                            onError = { msg ->
                                vm.onBiometricFailure(msg) {
                                }
                            }
                        )
                    }

                    // Botón de huella digital mejorado
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.secondaryContainer)
                                .clickable {
                                    if (vm.username.trim().isEmpty()) {
                                        vm.errorMessage = "Por favor, escribe tu usuario primero para usar la huella."
                                    } else if (biometricHelper.canUseBiometrics()) {
                                        biometricHelper.authenticate()
                                    } else {
                                        vm.errorMessage = "La biometría no está disponible en este dispositivo."
                                    }
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Fingerprint,
                                contentDescription = "Entrar con huella",
                                tint = MaterialTheme.colorScheme.onSecondaryContainer,
                                modifier = Modifier.size(40.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Usar huella digital",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        TextButton(onClick = onUsbTest) {
                            Text("Probar Lector USB Externo")
                        }
                    }
                }
            }

            if (vm.showPinDialog) {
                PinDialog(
                    pin = pinInput,
                    onPinChange = { pinInput = it },
                    onConfirm = {
                        vm.verifyPinAndLogin(pinInput, onAdminLogin, onUserLogin)
                    },
                    onDismiss = {
                        vm.showPinDialog = false
                    }
                )
            }
        }
    }
}
