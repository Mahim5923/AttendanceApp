package com.example.attendanceapp.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.attendanceapp.data.Attendance
import com.example.attendanceapp.data.AttendanceType
import com.example.attendanceapp.data.EmployeeSettings
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun CalendarAttendanceView(
    attendances: List<Attendance>,
    leaves: List<com.example.attendanceapp.data.LeaveRequest>,
    settings: EmployeeSettings,
    selectedDate: Calendar?,
    onDateSelected: (Calendar) -> Unit
) {
    var currentMonth by remember { mutableStateOf(Calendar.getInstance().apply { set(Calendar.DAY_OF_MONTH, 1) }) }
    
    val monthFormat = remember { SimpleDateFormat("MMMM yyyy", Locale.getDefault()) }

    Column(modifier = Modifier.fillMaxWidth()) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = { 
                currentMonth = (currentMonth.clone() as Calendar).apply { add(Calendar.MONTH, -1) } 
            }) {
                Icon(Icons.Default.ChevronLeft, contentDescription = "Previous Month")
            }
            Text(text = monthFormat.format(currentMonth.time), style = MaterialTheme.typography.titleMedium)
            IconButton(onClick = { 
                currentMonth = (currentMonth.clone() as Calendar).apply { add(Calendar.MONTH, 1) } 
            }) {
                Icon(Icons.Default.ChevronRight, contentDescription = "Next Month")
            }
        }

        // Days of Week
        Row(modifier = Modifier.fillMaxWidth()) {
            val days = listOf("S", "M", "T", "W", "T", "F", "S")
            days.forEach { day ->
                Text(
                    text = day,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Calendar Grid
        val calendar = currentMonth.clone() as Calendar
        calendar.set(Calendar.DAY_OF_MONTH, 1)
        val firstDayOfWeek = calendar.get(Calendar.DAY_OF_WEEK) - 1 // 0-based for Sunday=0
        val maxDays = calendar.getActualMaximum(Calendar.DAY_OF_MONTH)
        
        val today = Calendar.getInstance()

        var currentDay = 1
        for (week in 0..5) {
            Row(modifier = Modifier.fillMaxWidth()) {
                for (dayOfWeek in 0..6) {
                    if ((week == 0 && dayOfWeek < firstDayOfWeek) || currentDay > maxDays) {
                        Spacer(modifier = Modifier.weight(1f).aspectRatio(1f))
                    } else {
                        val dayCal = currentMonth.clone() as Calendar
                        dayCal.set(Calendar.DAY_OF_MONTH, currentDay)
                        
                        val isSelected = selectedDate?.let {
                            it.get(Calendar.YEAR) == dayCal.get(Calendar.YEAR) &&
                            it.get(Calendar.DAY_OF_YEAR) == dayCal.get(Calendar.DAY_OF_YEAR)
                        } ?: false

                        // Determine Color
                        val hasIn = attendances.any {
                            it.type == AttendanceType.IN &&
                            Calendar.getInstance().apply { timeInMillis = it.timestamp }.get(Calendar.YEAR) == dayCal.get(Calendar.YEAR) &&
                            Calendar.getInstance().apply { timeInMillis = it.timestamp }.get(Calendar.DAY_OF_YEAR) == dayCal.get(Calendar.DAY_OF_YEAR)
                        }
                        
                        val isApprovedLeave = leaves.any {
                            it.status == com.example.attendanceapp.data.LeaveStatus.APPROVED &&
                            Calendar.getInstance().apply { timeInMillis = it.dateTimestamp }.get(Calendar.YEAR) == dayCal.get(Calendar.YEAR) &&
                            Calendar.getInstance().apply { timeInMillis = it.dateTimestamp }.get(Calendar.DAY_OF_YEAR) == dayCal.get(Calendar.DAY_OF_YEAR)
                        }
                        
                        val isFuture = dayCal.after(today)
                        val isWeekOff = settings.weekOffs.contains(dayCal.get(Calendar.DAY_OF_WEEK))
                        
                        val bgColor = when {
                            isApprovedLeave -> Color(0xFFFFC107) // Yellow
                            hasIn -> Color(0xFF4CAF50) // Green
                            isWeekOff -> Color.Gray // Gray
                            isFuture -> Color.Transparent
                            else -> Color(0xFFF44336) // Red (Past workday, no IN)
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .padding(4.dp)
                                .clip(CircleShape)
                                .background(if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.3f) else Color.Transparent)
                                .clickable { onDateSelected(dayCal) },
                            contentAlignment = Alignment.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize(0.8f)
                                    .clip(CircleShape)
                                    .background(bgColor),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = currentDay.toString(),
                                    color = if (bgColor != Color.Transparent) Color.White else MaterialTheme.colorScheme.onSurface,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                        currentDay++
                    }
                }
            }
            if (currentDay > maxDays) break
        }
    }
}
