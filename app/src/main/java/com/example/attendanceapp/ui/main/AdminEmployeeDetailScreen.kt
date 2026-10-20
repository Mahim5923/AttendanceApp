package com.example.attendanceapp.ui.main

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation3.runtime.NavKey
import com.example.attendanceapp.AdminEmployeeSettings
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.Date
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

@Composable
fun AdminEmployeeDetailScreen(
    employeeId: String,
    viewModel: MainScreenViewModel,
    onNavigate: (NavKey) -> Unit,
    modifier: Modifier = Modifier
) {
    val attendances = viewModel.getAttendanceForEmployee(employeeId)
    val settings = viewModel.getEmployeeSettings(employeeId)

    Column(modifier = modifier.fillMaxSize().padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            val displayName = if (settings.displayName.isNotBlank()) settings.displayName else employeeId
            Text("Details: $displayName", style = MaterialTheme.typography.headlineSmall)
            Button(onClick = { onNavigate(AdminEmployeeSettings(employeeId)) }) {
                Text("Settings")
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
        
        Text("Branch: ${if (settings.branch.isNotBlank()) settings.branch else "None (Individual)"}")
        Text("Base Salary: ₹${settings.baseSalary}")
        Text("Shift: ${settings.checkInTimeHours}:${String.format("%02d", settings.checkInTimeMinutes)} - ${settings.checkOutTimeHours}:${String.format("%02d", settings.checkOutTimeMinutes)}")
        
        val weekDays = mapOf(
            java.util.Calendar.SUNDAY to "Sunday",
            java.util.Calendar.MONDAY to "Monday",
            java.util.Calendar.TUESDAY to "Tuesday",
            java.util.Calendar.WEDNESDAY to "Wednesday",
            java.util.Calendar.THURSDAY to "Thursday",
            java.util.Calendar.FRIDAY to "Friday",
            java.util.Calendar.SATURDAY to "Saturday"
        )
        val weekOffsStr = settings.weekOffs.mapNotNull { weekDays[it] }.joinToString(", ")
        Text("Week Offs: ${if (weekOffsStr.isNotEmpty()) weekOffsStr else "None"}")
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Text("Attendance History", style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.height(8.dp))

        if (attendances.isEmpty()) {
            Text("No records.")
        } else {
            val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }
            val groupedAttendances = attendances.groupBy { dateFormat.format(Date(it.timestamp)) }
            
            val uiState by viewModel.uiState.collectAsState()
            val leaves = if (uiState is MainScreenUiState.Success) {
                (uiState as MainScreenUiState.Success).leaveRequests.filter { it.employeeId == employeeId }
            } else emptyList()
            
            var selectedDate by remember { mutableStateOf<java.util.Calendar?>(null) }
            
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    CalendarAttendanceView(
                        attendances = attendances,
                        leaves = leaves,
                        settings = settings,
                        selectedDate = selectedDate,
                        onDateSelected = { selectedDate = it }
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    if (selectedDate != null) {
                        Text("Attendances for ${dateFormat.format(selectedDate!!.time)}", style = MaterialTheme.typography.titleMedium)
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
                
                val attendancesToShow = if (selectedDate != null) {
                    groupedAttendances[dateFormat.format(selectedDate!!.time)] ?: emptyList()
                } else {
                    emptyList()
                }
                
                if (selectedDate != null && attendancesToShow.isEmpty()) {
                    item { Text("No attendance records for this date.") }
                } else {
                    items(attendancesToShow) { attendance ->
                        val employeeName = viewModel.getEmployeeSettings(attendance.employeeId).displayName.ifBlank { attendance.employeeId }
                        AttendanceItem(attendance, isAdminView = true, employeeName = employeeName, viewModel = viewModel)
                    }
                }
            }
        }
    }
}
