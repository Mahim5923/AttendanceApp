package com.example.attendanceapp.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray

interface DataRepository {
    val attendances: StateFlow<List<Attendance>>
    val settings: StateFlow<List<EmployeeSettings>>
    val leaveRequests: StateFlow<List<LeaveRequest>>
    val messages: StateFlow<List<ChatMessage>>
    val appConfig: StateFlow<AppConfig?>
    var currentLoggedInUser: String?
    var isAdmin: Boolean

    fun login(username: String): Boolean
    fun logout()
    suspend fun addAttendance(attendance: Attendance)
    fun getEmployeeSettings(employeeId: String): EmployeeSettings
    suspend fun saveEmployeeSettings(setting: EmployeeSettings)
    fun getAllEmployees(): List<String>
    suspend fun addLeaveRequest(request: LeaveRequest)
    suspend fun updateLeaveRequestStatus(id: String, status: LeaveStatus)
    suspend fun sendMessage(message: ChatMessage)
    suspend fun markMessageAsRead(messageId: String)
}

fun DataRepository(context: Context): DataRepository = FirebaseDataRepositoryImpl(context)


