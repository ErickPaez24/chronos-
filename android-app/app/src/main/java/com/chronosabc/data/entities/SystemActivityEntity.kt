package com.chronosabc.data.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "system_activity")
data class SystemActivityEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val actorUserId: Long,
    val actionType: String, // "CREATE_USER", "DELETE_USER", "CHANGE_PASSWORD", "EXPORT_REPORT"
    val targetId: Long?,
    val metadata: String?,
    val timestamp: Long
)
