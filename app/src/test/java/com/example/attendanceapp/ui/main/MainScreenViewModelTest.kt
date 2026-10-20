package com.example.attendanceapp.ui.main

import com.example.attendanceapp.data.AppConfig
import com.example.attendanceapp.data.Attendance
import com.example.attendanceapp.data.ChatMessage
import com.example.attendanceapp.data.DataRepository
import com.example.attendanceapp.data.EmployeeSettings
import com.example.attendanceapp.data.LeaveRequest
import com.example.attendanceapp.data.LeaveStatus
import junit.framework.TestCase.assertEquals
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Test

class MainScreenViewModelTest {
  @Test
  fun uiState_initiallyLoading() = runTest {
    val viewModel = MainScreenViewModel(FakeDataRepository())
    assertEquals(MainScreenUiState.Loading, viewModel.uiState.first())
  }
}

private class FakeDataRepository : DataRepository {
  override val attendances: StateFlow<List<Attendance>> = MutableStateFlow(emptyList())
  override val settings: StateFlow<List<EmployeeSettings>> = MutableStateFlow(emptyList())
  override val leaveRequests: StateFlow<List<LeaveRequest>> = MutableStateFlow(emptyList())
  override val messages: StateFlow<List<ChatMessage>> = MutableStateFlow(emptyList())
  override val appConfig: StateFlow<AppConfig?> = MutableStateFlow(null)
  override val branches: StateFlow<List<com.example.attendanceapp.data.Branch>> = MutableStateFlow(emptyList())
  override var currentLoggedInUser: String? = null
  override var isAdmin: Boolean = false

  override fun login(username: String): Boolean = true
  override fun logout() {}
  override suspend fun addAttendance(attendance: Attendance) {}
  override fun getEmployeeSettings(employeeId: String): EmployeeSettings = EmployeeSettings(employeeId = employeeId)
  override suspend fun saveEmployeeSettings(setting: EmployeeSettings) {}
  override fun getAllEmployees(): List<String> = emptyList()
  override suspend fun addLeaveRequest(request: LeaveRequest) {}
  override suspend fun updateLeaveRequestStatus(id: String, status: LeaveStatus) {}
  override suspend fun sendMessage(message: ChatMessage) {}
  override suspend fun markMessageAsRead(messageId: String) {}
  override suspend fun saveBranch(branch: com.example.attendanceapp.data.Branch) {}
  override suspend fun deleteBranch(branchId: String) {}
}

