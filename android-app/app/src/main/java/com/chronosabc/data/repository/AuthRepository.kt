package com.chronosabc.data.repository

import android.content.Context
import com.chronosabc.data.db.ChronosAbcDatabase
import com.chronosabc.data.entities.AuthLogEntity
import com.chronosabc.security.PasswordHasher

class AuthRepository(context: Context) {
    private val db = ChronosAbcDatabase.getInstance(context)
    private val userDao = db.userDao()
    private val authLogDao = db.authLogDao()

    suspend fun loginWithPassword(username: String, password: String): Long? {
        val user = userDao.getByUsername(username) ?: return null
        if (!user.isActive) return null
        return if (PasswordHasher.verify(password, user.passwordHash)) {
            user.id
        } else null
    }

    suspend fun verifyPin(userId: Long, pin: String): Boolean {
        val user = userDao.getById(userId) ?: return false
        return PasswordHasher.verify(pin, user.pinHash)
    }

    suspend fun logAuth(
        userId: Long?,
        method: String,
        result: String,
        reason: String? = null,
        deviceInfo: String? = null
    ) {
        val log = AuthLogEntity(
            userId = userId,
            timestamp = System.currentTimeMillis(),
            method = method,
            result = result,
            reason = reason,
            deviceInfo = deviceInfo
        )
        authLogDao.insert(log)
    }
}
