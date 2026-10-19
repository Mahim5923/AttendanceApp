package com.example.attendanceapp.ui.main

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.attendanceapp.data.LeaveRequest
import com.example.attendanceapp.data.LeaveStatus
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun ManageLeavesScreen(
    viewModel: MainScreenViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(modifier = modifier.fillMaxSize().padding(16.dp)) {
        Text("Manage Leave Requests", style = MaterialTheme.typography.headlineSmall)
        Spacer(modifier = Modifier.height(16.dp))

        when (uiState) {
            is MainScreenUiState.Loading -> CircularProgressIndicator()
            is MainScreenUiState.Error -> Text("Error loading data")
            is MainScreenUiState.Success -> {
                val requests = (uiState as MainScreenUiState.Success).leaveRequests
                if (requests.isEmpty()) {
                    Text("No leave requests found.")
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(requests) { request ->
                            LeaveRequestItem(
                                request = request,
                                employeeName = viewModel.getEmployeeSettings(request.employeeId).displayName.ifBlank { request.employeeId },
                                onApprove = { viewModel.updateLeaveRequestStatus(request.id, LeaveStatus.APPROVED) },
                                onReject = { viewModel.updateLeaveRequestStatus(request.id, LeaveStatus.REJECTED) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun LeaveRequestItem(
    request: LeaveRequest,
    employeeName: String,
    onApprove: () -> Unit,
    onReject: () -> Unit
) {
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }
    val dateStr = dateFormat.format(Date(request.dateTimestamp))

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Employee: $employeeName", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Text("Date: $dateStr", style = MaterialTheme.typography.bodyLarge)
            Text("Reason: ${request.reason}", style = MaterialTheme.typography.bodyMedium)
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text("Status: ${request.status.name}")
                if (request.status == LeaveStatus.PENDING) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = onApprove, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)) {
                            Text("Approve")
                        }
                        OutlinedButton(onClick = onReject) {
                            Text("Reject")
                        }
                    }
                }
            }
        }
    }
}
