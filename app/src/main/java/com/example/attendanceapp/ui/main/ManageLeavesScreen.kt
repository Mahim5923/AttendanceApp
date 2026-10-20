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
    val branches by viewModel.branches.collectAsState()
    var selectedBranchFilter by remember { mutableStateOf<String?>(null) }

    Column(modifier = modifier.fillMaxSize().padding(16.dp)) {
        Text("Manage Leave Requests", style = MaterialTheme.typography.headlineSmall)
        Spacer(modifier = Modifier.height(12.dp))

        when (uiState) {
            is MainScreenUiState.Loading -> CircularProgressIndicator()
            is MainScreenUiState.Error -> Text("Error loading data")
            is MainScreenUiState.Success -> {
                val requests = (uiState as MainScreenUiState.Success).leaveRequests

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
                        label = { Text("All (${requests.size})") }
                    )
                    branches.forEach { b ->
                        val count = requests.count { req ->
                            val st = viewModel.getEmployeeSettings(req.employeeId)
                            st.branch.equals(b.name, ignoreCase = true) || st.branch.equals(b.id, ignoreCase = true)
                        }
                        FilterChip(
                            selected = selectedBranchFilter == b.name,
                            onClick = { selectedBranchFilter = b.name },
                            label = { Text("${b.name} ($count)") }
                        )
                    }
                    val unassignedCount = requests.count { req ->
                        viewModel.getEmployeeSettings(req.employeeId).branch.isBlank()
                    }
                    if (unassignedCount > 0) {
                        FilterChip(
                            selected = selectedBranchFilter == "",
                            onClick = { selectedBranchFilter = "" },
                            label = { Text("Unassigned ($unassignedCount)") }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Sort and filter by branch
                val filteredAndSortedRequests = requests
                    .filter { req ->
                        val b = viewModel.getEmployeeSettings(req.employeeId).branch
                        when (selectedBranchFilter) {
                            null -> true
                            "" -> b.isBlank()
                            else -> b.equals(selectedBranchFilter, ignoreCase = true)
                        }
                    }
                    .sortedWith(
                        compareBy(
                            { viewModel.getEmployeeSettings(it.employeeId).branch.ifBlank { "ZZZ_NoBranch" } },
                            { -it.requestedAtTimestamp }
                        )
                    )

                if (filteredAndSortedRequests.isEmpty()) {
                    Text("No leave requests found.")
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(filteredAndSortedRequests) { request ->
                            val empSettings = viewModel.getEmployeeSettings(request.employeeId)
                            LeaveRequestItem(
                                request = request,
                                employeeName = empSettings.displayName.ifBlank { request.employeeId },
                                branchName = empSettings.branch.ifBlank { "No Branch" },
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
    branchName: String,
    onApprove: () -> Unit,
    onReject: () -> Unit
) {
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }
    val dateStr = dateFormat.format(Date(request.dateTimestamp))

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Employee: $employeeName", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                    Text("Date: $dateStr", style = MaterialTheme.typography.bodyLarge)
                }
                Surface(
                    shape = MaterialTheme.shapes.extraSmall,
                    color = if (branchName != "No Branch") MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Text(
                        text = "🏢 $branchName",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (branchName != "No Branch") MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text("Reason: ${request.reason}", style = MaterialTheme.typography.bodyMedium)
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
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
