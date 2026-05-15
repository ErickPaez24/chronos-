package com.chronosabc

import android.app.Application
import com.chronosabc.data.db.ChronosAbcDatabase

class ChronosAbcApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ChronosAbcDatabase.seedAdminIfNeeded(this)
    }
}
