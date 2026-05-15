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
import com.chronosabc.data.repository.UserRepository
import kotlinx.coroutines.launch

class CreateUserViewModel(app: Application) : AndroidViewModel(app) {
    private val userRepo = UserRepository(app)

    var username by mutableStateOf("")
    var password by mutableStateOf("")
    var pin by mutableStateOf("")
    var role by mutableStateOf("USER")
    var errorMessage by mutableStateOf<String?>(null)
    var successMessage by mutableStateOf<String?>(null)
    var loading by mutableStateOf(false)

    fun createUser(onCreated: () -> Unit) {
        viewModelScope.launch {
            loading = true
            errorMessage = null
            successMessage = null
            try {
                if (username.isBlank() || password.isBlank() || pin.isBlank()) {
                    errorMessage = "Todos los campos son obligatorios"
                    return@launch
                }
                userRepo.createUser(username.trim(), password, pin, role)
                successMessage = "Usuario creado correctamente"
                onCreated()
                username = ""
                password = ""
                pin = ""
            } catch (e: Exception) {
                errorMessage = "Error al crear usuario: ${e.message}"
            } finally {
                loading = false
            }
        }
    }
}

@Composable
fun CreateUserScreen(
    onUserCreated: () -> Unit
) {
    val context = LocalContext.current
    val vm = remember { CreateUserViewModel(context.applicationContext as Application) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text("Crear usuario", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value = vm.username,
            onValueChange = { vm.username = it },
            label = { Text("Usuario") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value = vm.password,
            onValueChange = { vm.password = it },
            label = { Text("Contraseña") },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value = vm.pin,
            onValueChange = { vm.pin = it },
            label = { Text("PIN") },
            visualTransformation = PasswordVisualTransformation(),
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

        Spacer(Modifier.height(16.dp))

        if (vm.errorMessage != null) {
            Text(vm.errorMessage ?: "", color = MaterialTheme.colorScheme.error)
        }
        if (vm.successMessage != null) {
            Text(vm.successMessage ?: "", color = MaterialTheme.colorScheme.primary)
        }

        Spacer(Modifier.height(8.dp))

        Button(
            onClick = { vm.createUser(onUserCreated) },
            enabled = !vm.loading,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Guardar")
        }
    }
}

@Composable
fun DropdownMenuRoleSelector(
    selectedRole: String,
    onRoleSelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val roles = listOf("ADMIN", "USER")

    Box {
        TextButton(onClick = { expanded = true }) {
            Text("Rol: $selectedRole")
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            roles.forEach { role ->
                DropdownMenuItem(
                    text = { Text(role) },
                    onClick = {
                        onRoleSelected(role)
                        expanded = false
                    }
                )
            }
        }
    }
}
