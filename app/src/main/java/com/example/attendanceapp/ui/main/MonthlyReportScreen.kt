package com.example.attendanceapp.ui.main

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.attendanceapp.LanguageManager
import java.util.Calendar
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import java.text.DateFormatSymbols

@Composable
fun MonthlyReportScreen(
    viewModel: MainScreenViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val employees by viewModel.employees.collectAsState()
    val branches by viewModel.branches.collectAsState()
    var selectedBranchFilter by remember { mutableStateOf<String?>(null) }

    val cal = Calendar.getInstance()
    var selectedYear by remember { mutableIntStateOf(cal.get(Calendar.YEAR)) }
    var selectedMonth by remember { mutableIntStateOf(cal.get(Calendar.MONTH)) }

    Column(modifier = modifier.fillMaxSize().padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Monthly Report", style = MaterialTheme.typography.headlineSmall)
            TextButton(onClick = onNavigateBack) {
                Text(LanguageManager.t("Back"))
            }
        }
        
        Spacer(modifier = Modifier.height(12.dp))

        val monthName = remember(selectedMonth) { DateFormatSymbols().months[selectedMonth] }
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = {
                if (selectedMonth == 0) {
                    selectedMonth = 11
                    selectedYear--
                } else {
                    selectedMonth--
                }
            }) {
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Previous Month")
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
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "Next Month")
            }
        }
        
        Spacer(modifier = Modifier.height(12.dp))

        // Branch filter pills
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = selectedBranchFilter == null,
                onClick = { selectedBranchFilter = null },
                label = { Text("All (${employees.size})") }
            )
            branches.forEach { b ->
                val count = employees.count { 
                    val st = viewModel.getEmployeeSettings(it)
                    st.branch.equals(b.name, ignoreCase = true) || st.branch.equals(b.id, ignoreCase = true)
                }
                FilterChip(
                    selected = selectedBranchFilter == b.name,
                    onClick = { selectedBranchFilter = b.name },
                    label = { Text("${b.name} ($count)") }
                )
            }
            val unassignedCount = employees.count { viewModel.getEmployeeSettings(it).branch.isBlank() }
            if (unassignedCount > 0) {
                FilterChip(
                    selected = selectedBranchFilter == "",
                    onClick = { selectedBranchFilter = "" },
                    label = { Text("Unassigned ($unassignedCount)") }
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Filter and sort by branch
        val filteredAndSortedEmployees = employees
            .filter { empId ->
                val b = viewModel.getEmployeeSettings(empId).branch
                when (selectedBranchFilter) {
                    null -> true
                    "" -> b.isBlank()
                    else -> b.equals(selectedBranchFilter, ignoreCase = true)
                }
            }
            .sortedWith(
                compareBy(
                    { viewModel.getEmployeeSettings(it).branch.ifBlank { "ZZZ_NoBranch" } },
                    { viewModel.getEmployeeSettings(it).displayName.ifBlank { it } }
                )
            )

        if (filteredAndSortedEmployees.isEmpty()) {
            Text(LanguageManager.t("No employees found."))
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(filteredAndSortedEmployees) { empId ->
                    val empSettings = viewModel.getEmployeeSettings(empId)
                    val name = if (empSettings.displayName.isNotBlank()) empSettings.displayName else empId
                    val branchName = if (empSettings.branch.isNotBlank()) empSettings.branch else "No Branch"
                    val calc = viewModel.calculateSalaryForEmployee(empId, selectedYear, selectedMonth)

                    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Top
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(text = name, style = MaterialTheme.typography.titleMedium)
                                    Text(text = empId, style = MaterialTheme.typography.bodySmall)
                                }
                                Surface(
                                    shape = MaterialTheme.shapes.extraSmall,
                                    color = if (empSettings.branch.isNotBlank()) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
                                ) {
                                    Text(
                                        text = "🏢 $branchName",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (empSettings.branch.isNotBlank()) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                            
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
                            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
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
