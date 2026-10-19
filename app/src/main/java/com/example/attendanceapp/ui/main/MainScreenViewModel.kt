package com.example.attendanceapp.ui.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.attendanceapp.data.Attendance
import com.example.attendanceapp.data.DataRepository
import com.example.attendanceapp.data.EmployeeSettings
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import android.util.Log
import android.util.Base64
import com.example.attendanceapp.data.LeaveRequest
import com.example.attendanceapp.data.LeaveStatus
import com.example.attendanceapp.data.AttendanceType
import java.util.Calendar
import kotlin.math.abs

class MainScreenViewModel(private val dataRepository: DataRepository) : ViewModel() {

    private val auth by lazy { FirebaseAuth.getInstance() }

    fun getCurrentUser() = dataRepository.currentLoggedInUser ?: auth.currentUser?.email ?: "Unknown"

    fun isAdmin() = dataRepository.isAdmin

    suspend fun login(email: String, pass: String): Result<Boolean> {
        return try {
            auth.signInWithEmailAndPassword(email, pass).await()
            val userEmail = auth.currentUser?.email ?: email
            dataRepository.login(userEmail)
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun logout() {
        auth.signOut()
        dataRepository.logout()
    }

    val messages: StateFlow<List<com.example.attendanceapp.data.ChatMessage>> = dataRepository.messages
    val appConfig: StateFlow<com.example.attendanceapp.data.AppConfig?> = dataRepository.appConfig
    
    suspend fun sendMessage(message: com.example.attendanceapp.data.ChatMessage) {
        dataRepository.sendMessage(message)
    }

    fun markMessageAsRead(messageId: String) {
        viewModelScope.launch {
            dataRepository.markMessageAsRead(messageId)
        }
    }

    val uiState: StateFlow<MainScreenUiState> =
        combine(dataRepository.attendances, dataRepository.leaveRequests) { list, leaves -> 
            MainScreenUiState.Success(list, leaves) 
        }
            .stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(5000),
                initialValue = MainScreenUiState.Loading
            )

    fun addAttendance(attendance: Attendance) {
        viewModelScope.launch {
            try {
                val toSave = attendance.copy(employeeId = getCurrentUser())
                dataRepository.addAttendance(toSave)
                Log.d("Firebase", "Attendance saved successfully!")
            } catch (e: Exception) {
                Log.e("Firebase", "Error saving attendance", e)
            }
        }
    }
    
    fun getEmployeeSettings(employeeId: String): EmployeeSettings {
        return dataRepository.getEmployeeSettings(employeeId)
    }

    fun saveEmployeeSettings(settings: EmployeeSettings) {
        viewModelScope.launch {
            try {
                dataRepository.saveEmployeeSettings(settings)
                Log.d("Firebase", "Settings saved successfully!")
            } catch (e: Exception) {
                Log.e("Firebase", "Error saving settings", e)
            }
        }
    }
    
    val employees: StateFlow<List<String>> =
        combine(dataRepository.attendances, dataRepository.settings) { attendances, settings ->
            val fromSettings = settings.map { it.employeeId }
            val fromAttendances = attendances.map { it.employeeId }.filter { it != "admin" }
            (fromSettings + fromAttendances).distinct()
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun getAllEmployees(): List<String> {
        return employees.value
    }
    
    fun getAttendanceForEmployee(employeeId: String): List<Attendance> {
        return dataRepository.attendances.value.filter { it.employeeId == employeeId }
    }

    fun addLeaveRequest(request: LeaveRequest) {
        viewModelScope.launch {
            try {
                dataRepository.addLeaveRequest(request)
                Log.d("Firebase", "Leave request saved successfully!")
            } catch (e: Exception) {
                Log.e("Firebase", "Error saving leave request", e)
            }
        }
    }

    fun updateLeaveRequestStatus(id: String, status: LeaveStatus) {
        viewModelScope.launch {
            try {
                dataRepository.updateLeaveRequestStatus(id, status)
                Log.d("Firebase", "Leave status updated successfully!")
            } catch (e: Exception) {
                Log.e("Firebase", "Error updating leave request", e)
            }
        }
    }

    fun validateAttendance(type: AttendanceType): String? {
        val currentUser = getCurrentUser()
        val attendances = getAttendanceForEmployee(currentUser)
        val settings = getEmployeeSettings(currentUser)
        
        val now = Calendar.getInstance()
        val todayYear = now.get(Calendar.YEAR)
        val todayDay = now.get(Calendar.DAY_OF_YEAR)

        // Check if already marked today
        val hasMarkedToday = attendances.any {
            it.type == type && Calendar.getInstance().apply { timeInMillis = it.timestamp }.let { cal ->
                cal.get(Calendar.YEAR) == todayYear && cal.get(Calendar.DAY_OF_YEAR) == todayDay
            }
        }

        if (hasMarkedToday) {
            return "You have already marked ${type.name} today."
        }

        // Validate time window
        val scheduledTime = Calendar.getInstance().apply {
            if (type == AttendanceType.IN) {
                set(Calendar.HOUR_OF_DAY, settings.checkInTimeHours)
                set(Calendar.MINUTE, settings.checkInTimeMinutes)
            } else {
                set(Calendar.HOUR_OF_DAY, settings.checkOutTimeHours)
                set(Calendar.MINUTE, settings.checkOutTimeMinutes)
            }
            set(Calendar.SECOND, 0)
        }

        val diffMs = abs(now.timeInMillis - scheduledTime.timeInMillis)
        val diffHours = diffMs / (1000 * 60 * 60.0)

        if (diffHours > 1.0) {
            val formattedTime = String.format("%02d:%02d", 
                if (type == AttendanceType.IN) settings.checkInTimeHours else settings.checkOutTimeHours,
                if (type == AttendanceType.IN) settings.checkInTimeMinutes else settings.checkOutTimeMinutes
            )
            return "You can only mark ${type.name} within 1 hour of your scheduled time ($formattedTime)."
        }

        return null
    }

    fun calculateSalaryForEmployee(
        employeeId: String,
        year: Int = Calendar.getInstance().get(Calendar.YEAR),
        month: Int = Calendar.getInstance().get(Calendar.MONTH)
    ): SalaryCalculationResult {
        val settings = getEmployeeSettings(employeeId)
        val attendances = getAttendanceForEmployee(employeeId)
        val baseSalary = settings.baseSalary

        val cal = Calendar.getInstance()
        cal.set(Calendar.YEAR, year)
        cal.set(Calendar.MONTH, month)
        val maxDays = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
        var totalWorkingDays = 0
        for (i in 1..maxDays) {
            cal.set(Calendar.DAY_OF_MONTH, i)
            val dayOfWeek = cal.get(Calendar.DAY_OF_WEEK)
            if (!settings.weekOffs.contains(dayOfWeek)) {
                totalWorkingDays++
            }
        }

        val inDays = attendances
            .filter { it.type == AttendanceType.IN }
            .filter {
                val c = Calendar.getInstance().apply { timeInMillis = it.timestamp }
                c.get(Calendar.YEAR) == year && c.get(Calendar.MONTH) == month
            }
            .map { 
                val c = Calendar.getInstance().apply { timeInMillis = it.timestamp }
                c.get(Calendar.DAY_OF_YEAR)
            }
            .toSet()

        val outDays = attendances
            .filter { it.type == AttendanceType.OUT }
            .filter {
                val c = Calendar.getInstance().apply { timeInMillis = it.timestamp }
                c.get(Calendar.YEAR) == year && c.get(Calendar.MONTH) == month
            }
            .map { 
                val c = Calendar.getInstance().apply { timeInMillis = it.timestamp }
                c.get(Calendar.DAY_OF_YEAR)
            }
            .toSet()

        val presentDays = inDays.intersect(outDays).size

        val employeeLeaves = dataRepository.leaveRequests.value.filter { it.employeeId == employeeId && it.status == LeaveStatus.APPROVED }
        
        val approvedLeaveDays = employeeLeaves
            .filter {
                val c = Calendar.getInstance().apply { timeInMillis = it.dateTimestamp }
                c.get(Calendar.YEAR) == year && c.get(Calendar.MONTH) == month
            }
            .map { 
                val c = Calendar.getInstance().apply { timeInMillis = it.dateTimestamp }
                c.get(Calendar.DAY_OF_YEAR)
            }
            .distinct()
            .size

        val absentDays = (totalWorkingDays - presentDays - approvedLeaveDays).coerceAtLeast(0)
        val perDaySalary = if (totalWorkingDays > 0) baseSalary / totalWorkingDays else 0.0
        val deduction = perDaySalary * (absentDays + approvedLeaveDays)
        val netSalary = (baseSalary - deduction).coerceAtLeast(0.0)

        return SalaryCalculationResult(
            baseSalary, totalWorkingDays, presentDays, approvedLeaveDays, absentDays, perDaySalary, deduction, netSalary
        )
    }

    fun parseImageModel(uriString: String): Any {
        if (uriString.startsWith("data:image")) {
            try {
                val base64String = uriString.substringAfter("base64,")
                return Base64.decode(base64String, Base64.DEFAULT)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return uriString
    }
}

class MainScreenViewModelFactory(private val repository: DataRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(MainScreenViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return MainScreenViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}

data class SalaryCalculationResult(
    val baseSalary: Double,
    val totalWorkingDays: Int,
    val presentDays: Int,
    val approvedLeaveDays: Int,
    val absentDays: Int,
    val perDaySalary: Double,
    val deduction: Double,
    val netSalary: Double
)

sealed interface MainScreenUiState {
    object Loading : MainScreenUiState
    data class Error(val throwable: Throwable) : MainScreenUiState
    data class Success(val data: List<Attendance>, val leaveRequests: List<LeaveRequest> = emptyList()) : MainScreenUiState
}
