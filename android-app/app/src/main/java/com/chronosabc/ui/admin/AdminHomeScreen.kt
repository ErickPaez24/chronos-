package com.chronosabc.ui.admin

import android.app.Application
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.chronosabc.data.entities.UserEntity
import com.chronosabc.data.repository.UserRepository
import kotlinx.coroutines.launch

private enum class AdminSection {
    DASHBOARD,
    USERS,
    CREATE_USER,
    EDIT_USER,
    REPORTS
}

class AdminHomeViewModel(app: Application) : AndroidViewModel(app) {
    private val userRepo = UserRepository(app)

    var users by mutableStateOf<List<UserEntity>>(emptyList())
        private set

    var selectedUser by mutableStateOf<UserEntity?>(null)

    init {
        loadUsers()
    }

    fun loadUsers() {
        viewModelScope.launch {
            users = userRepo.getAllUsers()
        }
    }

    fun onUserUpdated() {
        loadUsers()
    }
}

@Composable
fun AdminHomeScreen() {
    val context = LocalContext.current
    val vm = remember { AdminHomeViewModel(context.applicationContext as Application) }

    var currentSection by remember { mutableStateOf(AdminSection.DASHBOARD) }

    Scaffold(
        topBar = {
            @OptIn(ExperimentalMaterial3Api::class)
            TopAppBar(
                title = { Text("Admin - Chronos ABC") }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp)
                .fillMaxSize()
        ) {
            // Menú simple
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(onClick = { currentSection = AdminSection.DASHBOARD }) {
                    Text("Inicio")
                }
                Button(onClick = { currentSection = AdminSection.USERS }) {
                    Text("Usuarios")
                }
                Button(onClick = { currentSection = AdminSection.CREATE_USER }) {
                    Text("Crear")
                }
                Button(onClick = { currentSection = AdminSection.REPORTS }) {
                    Text("Reportes")
                }
            }

            Spacer(Modifier.height(16.dp))

            when (currentSection) {
                AdminSection.DASHBOARD -> {
                    Text("Panel de administración", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Text("Desde aquí puedes:")
                    Text("- Gestionar usuarios (crear/editar/eliminar)")
                    Text("- Habilitar biometría para usuarios")
                    Text("- Generar reportes PDF de autenticaciones por fecha")
                }

                AdminSection.USERS -> {
                    UserListScreen(
                        onCreateUser = { currentSection = AdminSection.CREATE_USER },
                        onEditUser = { user ->
                            vm.selectedUser = user
                            currentSection = AdminSection.EDIT_USER
                        }
                    )
                }

                AdminSection.CREATE_USER -> {
                    CreateUserScreen(
                        onUserCreated = {
                            vm.loadUsers()
                            currentSection = AdminSection.USERS
                        }
                    )
                }

                AdminSection.EDIT_USER -> {
                    val user = vm.selectedUser
                    if (user != null) {
                        EditUserScreen(
                            user = user,
                            onBack = {
                                vm.loadUsers()
                                currentSection = AdminSection.USERS
                            }
                        )
                    } else {
                        Text("Ningún usuario seleccionado")
                    }
                }

                AdminSection.REPORTS -> {
                    ReportsScreen()
                }
            }
        }
    }
}
