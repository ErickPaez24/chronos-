package com.chronosabc.ui.admin

import android.app.Application
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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

class UserListViewModel(app: Application) : AndroidViewModel(app) {
    private val userRepo = UserRepository(app)
    var users by mutableStateOf<List<UserEntity>>(emptyList())
        private set

    init {
        loadUsers()
    }

    fun loadUsers() {
        viewModelScope.launch {
            users = userRepo.getAllUsers()
        }
    }
}

@Composable
fun UserListScreen(
    onCreateUser: () -> Unit = {},
    onEditUser: (UserEntity) -> Unit = {}
) {
    val context = LocalContext.current
    val vm = remember { UserListViewModel(context.applicationContext as Application) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text("Usuarios", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))

        Button(onClick = onCreateUser) {
            Text("Crear usuario")
        }

        Spacer(Modifier.height(8.dp))

        LazyColumn {
            items(vm.users.size) { index ->
                val user = vm.users[index]
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onEditUser(user) }
                        .padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(user.username)
                    Text(user.role)
                }
                HorizontalDivider()
            }
        }
    }
}
