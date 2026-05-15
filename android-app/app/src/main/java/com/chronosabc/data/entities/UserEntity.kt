package com.chronosabc.data.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val username: String,
    val passwordHash: String,
    val pinHash: String,
    val role: String, // "ADMIN" o "USER"
    val isActive: Boolean = true,
    val biometricEnabled: Boolean = false,
    val createdAt: Long,
    val updatedAt: Long
)
