package com.chronosabc.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.chronosabc.data.entities.AuthLogEntity

@Dao
interface AuthLogDao {

    @Insert
    suspend fun insert(log: AuthLogEntity): Long

    @Query("""
        SELECT * FROM auth_logs
        WHERE timestamp BETWEEN :start AND :end
        ORDER BY timestamp DESC
    """)
    suspend fun getByDateRange(start: Long, end: Long): List<AuthLogEntity>
}
