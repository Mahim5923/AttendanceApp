package com.example.attendanceapp

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable
import com.example.attendanceapp.data.AttendanceType

@Serializable data object Login : NavKey

@Serializable data object EmployeeDashboard : NavKey

@Serializable data object EmployeeProfile : NavKey

@Serializable data object AdminDashboard : NavKey

@Serializable data class AdminEmployeeDetail(val employeeId: String) : NavKey

@Serializable data class AdminEmployeeSettings(val employeeId: String) : NavKey

@Serializable data class MarkAttendance(val type: String) : NavKey

@Serializable data object ViewAttendance : NavKey

@Serializable data object Calculator : NavKey

@Serializable data object RequestLeave : NavKey

@Serializable data object ManageLeaves : NavKey

@Serializable data object ChatListScreenKey : NavKey

@Serializable data class ChatScreenKey(val chatPartnerId: String, val chatPartnerName: String) : NavKey

@Serializable data object MonthlyReport : NavKey

@Serializable data class ForceUpdate(val updateUrl: String) : NavKey
