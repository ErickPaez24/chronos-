package com.chronosabc.data.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "auth_logs")
data class AuthLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val userId: Long?,
    val timestamp: Long,
    val method: String, // "PASSWORD", "BIOMETRIC", "PIN"
    val result: String, // "SUCCESS", "FAILURE", "LOCKED_OUT"
    val reason: String?,
    val deviceInfo: String?
)
