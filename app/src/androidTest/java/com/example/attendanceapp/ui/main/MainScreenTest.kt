package com.example.attendanceapp.ui.main

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.example.attendanceapp.data.AppConfig
import com.example.attendanceapp.data.Attendance
import com.example.attendanceapp.data.ChatMessage
import com.example.attendanceapp.data.DataRepository
import com.example.attendanceapp.data.EmployeeSettings
import com.example.attendanceapp.data.LeaveRequest
import com.example.attendanceapp.data.LeaveStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/** UI tests for [com.example.attendanceapp.ui.main.MainScreen]. */
class MainScreenTest {

  @get:Rule val composeTestRule = createAndroidComposeRule<ComponentActivity>()

  private lateinit var viewModel: MainScreenViewModel

  @Before
  fun setup() {
    viewModel = MainScreenViewModel(FakeDataRepository())
    composeTestRule.setContent {
      MainScreen(
        viewModel = viewModel,
        onItemClick = {},
        onLogout = {},
      )
    }
  }

  @Test
  fun welcomeText_exists() {
    composeTestRule.onNodeWithText("Welcome, TestUser").assertExists()
  }

  @Test
  fun mainButtons_exist() {
    composeTestRule.onNodeWithText("In").assertExists()
    composeTestRule.onNodeWithText("Out").assertExists()
    composeTestRule.onNodeWithText("View My Attendance").assertExists()
    composeTestRule.onNodeWithText("Request Leave").assertExists()
    composeTestRule.onNodeWithText("Salary Calculator").assertExists()
  }
}

private class FakeDataRepository : DataRepository {
  override val attendances: StateFlow<List<Attendance>> = MutableStateFlow(emptyList())
  override val settings: StateFlow<List<EmployeeSettings>> = MutableStateFlow(emptyList())
  override val leaveRequests: StateFlow<List<LeaveRequest>> = MutableStateFlow(emptyList())
  override val messages: StateFlow<List<ChatMessage>> = MutableStateFlow(emptyList())
  override val appConfig: StateFlow<AppConfig?> = MutableStateFlow(null)
  override val branches: StateFlow<List<com.example.attendanceapp.data.Branch>> = MutableStateFlow(emptyList())
  override var currentLoggedInUser: String? = "TestUser"
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

