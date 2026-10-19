package com.example.attendanceapp

import android.app.Application
import com.example.attendanceapp.data.DataRepository

class AttendanceApplication : Application() {
    lateinit var repository: DataRepository
    
    override fun onCreate() {
        super.onCreate()
        repository = DataRepository(this)
    }
}
