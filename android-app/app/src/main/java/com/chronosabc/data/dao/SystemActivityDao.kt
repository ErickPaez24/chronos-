package com.chronosabc.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.chronosabc.data.entities.SystemActivityEntity

@Dao
interface SystemActivityDao {

    @Insert
    suspend fun insert(activity: SystemActivityEntity): Long

    @Query("""
        SELECT * FROM system_activity
        WHERE timestamp BETWEEN :start AND :end
        ORDER BY timestamp DESC
    """)
    suspend fun getByDateRange(start: Long, end: Long): List<SystemActivityEntity>
}
