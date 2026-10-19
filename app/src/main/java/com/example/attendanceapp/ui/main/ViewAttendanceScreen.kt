package com.example.attendanceapp.ui.main

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.foundation.clickable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.animation.animateContentSize
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.attendanceapp.data.Attendance
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun ViewAttendanceScreen(
    viewModel: MainScreenViewModel,
    isAdminView: Boolean = false,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(modifier = modifier.fillMaxSize().padding(16.dp)) {
        if (!isAdminView) {
            Text("My Attendance", style = MaterialTheme.typography.headlineSmall)
            Spacer(modifier = Modifier.height(16.dp))
        }

        when (uiState) {
            is MainScreenUiState.Loading -> CircularProgressIndicator()
            is MainScreenUiState.Error -> Text("Error loading data")
            is MainScreenUiState.Success -> {
                val list = (uiState as MainScreenUiState.Success).data
                val filteredList = if (isAdminView) list else list.filter { it.employeeId == viewModel.getCurrentUser() }
                
                val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }
                // Preserve order by using map and grouping (assuming already sorted by timestamp descending)
                val groupedAttendances = filteredList.groupBy { dateFormat.format(Date(it.timestamp)) }
                
                var isRefreshing by remember { mutableStateOf(false) }
                val scope = rememberCoroutineScope()
                
                PullToRefreshBox(
                    isRefreshing = isRefreshing,
                    onRefresh = {
                        scope.launch {
                            isRefreshing = true
                            delay(800)
                            isRefreshing = false
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                ) {
                    var selectedDate by remember { mutableStateOf<Calendar?>(null) }
                    val settings = viewModel.getEmployeeSettings(viewModel.getCurrentUser())

                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        item {
                            CalendarAttendanceView(
                                attendances = filteredList,
                                leaves = (uiState as MainScreenUiState.Success).leaveRequests.filter { if (isAdminView) true else it.employeeId == viewModel.getCurrentUser() },
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
                                AttendanceItem(attendance, isAdminView, employeeName, viewModel)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DateGroupItem(date: String, attendances: List<Attendance>, isAdminView: Boolean, viewModel: MainScreenViewModel) {
    var expanded by remember { mutableStateOf(false) }

    Card(modifier = Modifier.fillMaxWidth().animateContentSize()) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded }
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = date, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                Icon(
                    imageVector = if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                    contentDescription = if (expanded) "Collapse" else "Expand"
                )
            }
            if (expanded) {
                Column(modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
                    attendances.forEachIndexed { index, item ->
                        val employeeName = viewModel.getEmployeeSettings(item.employeeId).displayName.ifBlank { item.employeeId }
                        AttendanceItem(item, isAdminView, employeeName, viewModel)
                        if (index < attendances.size - 1) {
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AttendanceItem(attendance: Attendance, isAdminView: Boolean, employeeName: String = "", viewModel: MainScreenViewModel) {
    val timeFormat = remember { SimpleDateFormat("hh:mm a", Locale.getDefault()) }
    val timeString = timeFormat.format(Date(attendance.timestamp))

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(16.dp)) {
            AsyncImage(
                model = viewModel.parseImageModel(attendance.photoUri),
                contentDescription = "Attendance Photo",
                modifier = Modifier.size(80.dp),
                contentScale = ContentScale.Crop
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                if (isAdminView) {
                    Text("Employee: $employeeName", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                }
                Text("${attendance.type} at $timeString", style = if (isAdminView) MaterialTheme.typography.bodyMedium else MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(4.dp))
                Text("Lat: ${String.format("%.4f", attendance.latitude)}", style = MaterialTheme.typography.bodySmall)
                Text("Lon: ${String.format("%.4f", attendance.longitude)}", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
