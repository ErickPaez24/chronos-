package com.chronosabc.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.chronosabc.data.dao.AuthLogDao
import com.chronosabc.data.dao.SystemActivityDao
import com.chronosabc.data.dao.UserDao
import com.chronosabc.data.entities.AuthLogEntity
import com.chronosabc.data.entities.SystemActivityEntity
import com.chronosabc.data.entities.UserEntity
import com.chronosabc.security.PasswordHasher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(
    entities = [
        UserEntity::class,
        AuthLogEntity::class,
        SystemActivityEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class ChronosAbcDatabase : RoomDatabase() {

    abstract fun userDao(): UserDao
    abstract fun authLogDao(): AuthLogDao
    abstract fun systemActivityDao(): SystemActivityDao

    companion object {
        @Volatile
        private var INSTANCE: ChronosAbcDatabase? = null

        fun getInstance(context: Context): ChronosAbcDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    ChronosAbcDatabase::class.java,
                    "chronos_abc.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }

        fun seedAdminIfNeeded(context: Context) {
            val db = getInstance(context)
            CoroutineScope(Dispatchers.IO).launch {
                val count = db.userDao().countUsers()
                if (count == 0) {
                    val now = System.currentTimeMillis()
                    val adminUser = UserEntity(
                        username = "admin",
                        passwordHash = PasswordHasher.hash("121517"),
                        pinHash = PasswordHasher.hash("121517"),
                        role = "ADMIN",
                        isActive = true,
                        biometricEnabled = false,
                        createdAt = now,
                        updatedAt = now
                    )
                    db.userDao().insert(adminUser)
                }
            }
        }
    }
}
