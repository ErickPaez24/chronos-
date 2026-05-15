package com.chronosabc.data.repository

import android.content.Context
import com.chronosabc.data.db.ChronosAbcDatabase
import com.chronosabc.data.entities.UserEntity
import com.chronosabc.security.PasswordHasher

class UserRepository(context: Context) {
    private val db = ChronosAbcDatabase.getInstance(context)
    private val userDao = db.userDao()

    suspend fun getAllUsers(): List<UserEntity> = userDao.getAll()

    suspend fun getUserById(id: Long): UserEntity? = userDao.getById(id)

    suspend fun getUserByUsername(username: String): UserEntity? =
        userDao.getByUsername(username)

    suspend fun createUser(
        username: String,
        password: String,
        pin: String,
        role: String
    ): Long {
        val now = System.currentTimeMillis()
        val user = UserEntity(
            username = username,
            passwordHash = PasswordHasher.hash(password),
            pinHash = PasswordHasher.hash(pin),
            role = role,
            isActive = true,
            biometricEnabled = false,
            createdAt = now,
            updatedAt = now
        )
        return userDao.insert(user)
    }

    suspend fun updateUser(user: UserEntity) {
        userDao.update(user.copy(updatedAt = System.currentTimeMillis()))
    }

    suspend fun deleteUser(user: UserEntity) {
        userDao.delete(user)
    }
}
