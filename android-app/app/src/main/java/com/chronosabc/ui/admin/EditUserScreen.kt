package com.chronosabc.ui.admin

import android.app.Application
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.chronosabc.data.entities.UserEntity
import com.chronosabc.data.repository.UserRepository
import com.chronosabc.security.PasswordHasher
import kotlinx.coroutines.launch

class EditUserViewModel(app: Application, private val userInit: UserEntity) : AndroidViewModel(app) {
    private val userRepo = UserRepository(app)

    var username by mutableStateOf(userInit.username)
    var role by mutableStateOf(userInit.role)
    var isActive by mutableStateOf(userInit.isActive)
    var biometricEnabled by mutableStateOf(userInit.biometricEnabled)
    var newPassword by mutableStateOf("")
    var newPin by mutableStateOf("")

    var message by mutableStateOf<String?>(null)
    var loading by mutableStateOf(false)

    fun saveChanges(onSaved: () -> Unit) {
        viewModelScope.launch {
            loading = true
            message = null
            try {
                var updated = userInit.copy(
                    username = username.trim(),
                    role = role,
                    isActive = isActive,
                    biometricEnabled = biometricEnabled
                )
                if (newPassword.isNotBlank()) {
                    updated = updated.copy(passwordHash = PasswordHasher.hash(newPassword))
                }
                if (newPin.isNotBlank()) {
                    updated = updated.copy(pinHash = PasswordHasher.hash(newPin))
                }
                userRepo.updateUser(updated)
                message = "Usuario actualizado"
                onSaved()
            } catch (e: Exception) {
                message = "Error: ${e.message}"
            } finally {
                loading = false
            }
        }
    }
}

@Composable
fun EditUserScreen(
    user: UserEntity,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val vm = remember { EditUserViewModel(context.applicationContext as Application, user) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text("Editar usuario", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value = vm.username,
            onValueChange = { vm.username = it },
            label = { Text("Usuario") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(8.dp))

        Row {
            Text("Rol: ", modifier = Modifier.padding(top = 12.dp))
            Spacer(Modifier.width(8.dp))
            DropdownMenuRoleSelector(
                selectedRole = vm.role,
                onRoleSelected = { vm.role = it }
            )
        }

        Spacer(Modifier.height(8.dp))

        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Text("Activo")
            Spacer(Modifier.width(8.dp))
            Switch(
                checked = vm.isActive,
                onCheckedChange = { vm.isActive = it }
            )
        }

        Spacer(Modifier.height(8.dp))

        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Text("Biometría habilitada")
            Spacer(Modifier.width(8.dp))
            Switch(
                checked = vm.biometricEnabled,
                onCheckedChange = { vm.biometricEnabled = it }
            )
        }

        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value = vm.newPassword,
            onValueChange = { vm.newPassword = it },
            label = { Text("Nueva contraseña (opcional)") },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value = vm.newPin,
            onValueChange = { vm.newPin = it },
            label = { Text("Nuevo PIN (opcional)") },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(16.dp))

        vm.message?.let {
            Text(it)
        }

        Spacer(Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = { vm.saveChanges(onBack) },
                enabled = !vm.loading,
                modifier = Modifier.weight(1f)
            ) {
                Text("Guardar")
            }
            OutlinedButton(
                onClick = onBack,
                modifier = Modifier.weight(1f)
            ) {
                Text("Volver")
            }
        }
    }
}
