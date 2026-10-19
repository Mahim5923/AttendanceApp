package com.example.attendanceapp.ui.main

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.attendanceapp.LanguageManager
import java.util.Calendar
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import java.text.DateFormatSymbols

@Composable
fun MonthlyReportScreen(
    viewModel: MainScreenViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val employees by viewModel.employees.collectAsState()

    val cal = Calendar.getInstance()
    var selectedYear by remember { mutableIntStateOf(cal.get(Calendar.YEAR)) }
    var selectedMonth by remember { mutableIntStateOf(cal.get(Calendar.MONTH)) }

    Column(modifier = modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Monthly Report", style = MaterialTheme.typography.headlineSmall)
            TextButton(onClick = onNavigateBack) {
                Text(LanguageManager.t("Back"))
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))

        val monthName = remember(selectedMonth) { DateFormatSymbols().months[selectedMonth] }
        
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = {
                if (selectedMonth == 0) {
                    selectedMonth = 11
                    selectedYear--
                } else {
                    selectedMonth--
                }
            }) {
                Icon(Icons.Default.KeyboardArrowLeft, contentDescription = "Previous Month")
            }
            Text("$monthName $selectedYear", style = MaterialTheme.typography.titleMedium)
            IconButton(onClick = {
                if (selectedMonth == 11) {
                    selectedMonth = 0
                    selectedYear++
                } else {
                    selectedMonth++
                }
            }) {
                Icon(Icons.Default.KeyboardArrowRight, contentDescription = "Next Month")
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))

        if (employees.isEmpty()) {
            Text(LanguageManager.t("No employees found."))
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(employees) { empId ->
                    val empSettings = viewModel.getEmployeeSettings(empId)
                    val name = if (empSettings.displayName.isNotBlank()) empSettings.displayName else empId
                    val calc = viewModel.calculateSalaryForEmployee(empId, selectedYear, selectedMonth)

                    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(text = name, style = MaterialTheme.typography.titleMedium)
                            Text(text = empId, style = MaterialTheme.typography.bodySmall)
                            
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Base Salary:")
                                Text("₹${calc.baseSalary}")
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Total Working Days:")
                                Text("${calc.totalWorkingDays}")
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Days Present:")
                                Text("${calc.presentDays}")
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Approved Leaves:")
                                Text("${calc.approvedLeaveDays}")
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Days Absent:")
                                Text("${calc.absentDays}")
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Per Day Salary:")
                                Text(String.format("₹%.2f", calc.perDaySalary))
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Deduction:")
                                Text(String.format("- ₹%.2f", calc.deduction), color = MaterialTheme.colorScheme.error)
                            }
                            Divider(modifier = Modifier.padding(vertical = 8.dp))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Net Salary:", style = MaterialTheme.typography.titleMedium)
                                Text(String.format("₹%.2f", calc.netSalary), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
            }
        }
    }
}
