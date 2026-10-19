package com.example.attendanceapp.ui.main

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.example.attendanceapp.data.LeaveRequest
import java.util.UUID
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.Date
import android.app.DatePickerDialog
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RequestLeaveScreen(
    viewModel: MainScreenViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val myLeaves = (uiState as? MainScreenUiState.Success)?.leaveRequests?.filter { it.employeeId == viewModel.getCurrentUser() } ?: emptyList()
    val context = LocalContext.current
    var reason by remember { mutableStateOf("") }
    var selectedDateMillis by remember { mutableStateOf<Long?>(null) }
    
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }

    Column(
        modifier = modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Request Leave", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(32.dp))
        
        OutlinedButton(
            onClick = {
                val calendar = Calendar.getInstance()
                DatePickerDialog(
                    context,
                    { _, year, month, dayOfMonth ->
                        val cal = Calendar.getInstance()
                        cal.set(year, month, dayOfMonth, 0, 0, 0)
                        cal.set(Calendar.MILLISECOND, 0)
                        selectedDateMillis = cal.timeInMillis
                    },
                    calendar.get(Calendar.YEAR),
                    calendar.get(Calendar.MONTH),
                    calendar.get(Calendar.DAY_OF_MONTH)
                ).show()
            },
            modifier = Modifier.fillMaxWidth().height(56.dp)
        ) {
            val dateStr = selectedDateMillis?.let { dateFormat.format(Date(it)) } ?: "Select Date"
            Text(dateStr)
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        OutlinedTextField(
            value = reason,
            onValueChange = { reason = it },
            label = { Text("Reason for leave") },
            modifier = Modifier.fillMaxWidth().height(150.dp)
        )
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Button(
            onClick = {
                if (selectedDateMillis != null && reason.isNotBlank()) {
                    val request = LeaveRequest(
                        id = UUID.randomUUID().toString(),
                        employeeId = viewModel.getCurrentUser(),
                        dateTimestamp = selectedDateMillis!!,
                        reason = reason,
                        requestedAtTimestamp = System.currentTimeMillis()
                    )
                    viewModel.addLeaveRequest(request)
                    Toast.makeText(context, "Leave Requested!", Toast.LENGTH_SHORT).show()
                    reason = ""
                    selectedDateMillis = null
                } else {
                    Toast.makeText(context, "Please fill out all fields", Toast.LENGTH_SHORT).show()
                }
            },
            modifier = Modifier.fillMaxWidth().height(56.dp),
            enabled = selectedDateMillis != null && reason.isNotBlank()
        ) {
            Text("Submit Request")
        }
        
        Spacer(modifier = Modifier.height(32.dp))
        Divider()
        Spacer(modifier = Modifier.height(16.dp))
        Text("My Leave Requests", style = MaterialTheme.typography.titleLarge)
        Spacer(modifier = Modifier.height(16.dp))

        if (myLeaves.isEmpty()) {
            Text("You have not requested any leaves yet.")
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth().weight(1f)
            ) {
                items(myLeaves) { leave ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            val leaveDateStr = dateFormat.format(Date(leave.dateTimestamp))
                            Text("Date: $leaveDateStr", style = MaterialTheme.typography.titleMedium)
                            Text("Reason: ${leave.reason}", style = MaterialTheme.typography.bodyMedium)
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            val statusColor = when (leave.status) {
                                com.example.attendanceapp.data.LeaveStatus.APPROVED -> MaterialTheme.colorScheme.primary
                                com.example.attendanceapp.data.LeaveStatus.REJECTED -> MaterialTheme.colorScheme.error
                                else -> MaterialTheme.colorScheme.onSurface
                            }
                            Text("Status: ${leave.status.name}", color = statusColor, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}
