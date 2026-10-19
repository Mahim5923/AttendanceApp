package com.example.attendanceapp.ui.main

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.attendanceapp.data.AttendanceType
import com.example.attendanceapp.data.LeaveStatus
import java.util.Calendar
import kotlin.math.roundToInt

@Composable
fun CalculatorScreen(
    viewModel: MainScreenViewModel,
    modifier: Modifier = Modifier
) {
    val currentUser = viewModel.getCurrentUser()
    val result = viewModel.calculateSalaryForEmployee(currentUser)

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Salary Calculator Dashboard", style = MaterialTheme.typography.headlineSmall)
        Spacer(modifier = Modifier.height(24.dp))
        
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Base Salary: ₹${result.baseSalary.roundToInt()}", style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Total Working Days (Month): ${result.totalWorkingDays}")
                Text("Days Present: ${result.presentDays}")
                Text("Approved Leaves: ${result.approvedLeaveDays}", color = MaterialTheme.colorScheme.primary)
                Text("Days Absent: ${result.absentDays}", color = MaterialTheme.colorScheme.error)
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Per Day Salary: ₹${result.perDaySalary.roundToInt()}")
                Text("Total Deduction: ₹${result.deduction.roundToInt()}", color = MaterialTheme.colorScheme.error)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Estimated Net Salary: ₹${result.netSalary.roundToInt()}", style = MaterialTheme.typography.titleLarge)
            }
        }
    }
}
