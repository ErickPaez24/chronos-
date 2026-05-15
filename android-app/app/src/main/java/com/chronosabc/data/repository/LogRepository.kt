package com.chronosabc.data.repository

import android.content.Context
import com.chronosabc.data.db.ChronosAbcDatabase
import com.chronosabc.data.entities.SystemActivityEntity

class LogRepository(context: Context) {
    private val db = ChronosAbcDatabase.getInstance(context)
    private val authLogDao = db.authLogDao()
    private val systemActivityDao = db.systemActivityDao()

    suspend fun getAuthLogs(start: Long, end: Long) =
        authLogDao.getByDateRange(start, end)

    suspend fun logSystemActivity(
        actorUserId: Long,
        actionType: String,
        targetId: Long? = null,
        metadata: String? = null
    ) {
        systemActivityDao.insert(
            SystemActivityEntity(
                actorUserId = actorUserId,
                actionType = actionType,
                targetId = targetId,
                metadata = metadata,
                timestamp = System.currentTimeMillis()
            )
        )
    }
}
