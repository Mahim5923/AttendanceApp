package com.example.attendanceapp.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.LaunchedEffect
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.animation.animateContentSize
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.navigation3.runtime.NavKey
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import coil.compose.AsyncImage
import com.example.attendanceapp.AdminEmployeeDetail
import com.example.attendanceapp.ManageLeaves
import com.example.attendanceapp.ChatListScreenKey
import android.app.Activity
import android.content.Intent
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import com.example.attendanceapp.LanguageManager
import java.io.OutputStreamWriter

@Composable
fun AdminDashboardScreen(
    viewModel: MainScreenViewModel,
    onNavigate: (NavKey) -> Unit,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val employees by viewModel.employees.collectAsState()
    
    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                try {
                    context.contentResolver.openOutputStream(uri)?.use { outputStream ->
                        OutputStreamWriter(outputStream).use { writer ->
                            writer.write("Employee Name,Base Salary,Total Working Days,Days Present,Approved Leaves,Days Absent,Per Day Salary,Deduction,Net Salary\n")
                            employees.forEach { empId ->
                                val empSettings = viewModel.getEmployeeSettings(empId)
                                val name = if (empSettings.displayName.isNotBlank()) empSettings.displayName else empId
                                val calc = viewModel.calculateSalaryForEmployee(empId)
                                writer.write("$name,${calc.baseSalary},${calc.totalWorkingDays},${calc.presentDays},${calc.approvedLeaveDays},${calc.absentDays},${calc.perDaySalary},${calc.deduction},${calc.netSalary}\n")
                            }
                        }
                    }
                    Toast.makeText(context, "Report saved successfully!", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    Toast.makeText(context, "Failed to save report.", Toast.LENGTH_SHORT).show()
                    e.printStackTrace()
                }
            }
        }
    }

    var isRefreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        val currentUser = viewModel.getCurrentUser()
        if (currentUser.isBlank() || currentUser == "Unknown") {
            onLogout()
        }
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { onNavigate(ChatListScreenKey) }, containerColor = androidx.compose.ui.graphics.Color.Red, contentColor = androidx.compose.ui.graphics.Color.White) {
                Icon(Icons.Default.Chat, contentDescription = "Chat")
            }
        },
        modifier = modifier.fillMaxSize()
    ) { paddingValues ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                scope.launch {
                    isRefreshing = true
                    delay(800)
                    isRefreshing = false
                }
            },
            modifier = Modifier.fillMaxSize().padding(paddingValues)
        ) {
            Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(LanguageManager.t("Admin Dashboard"), style = MaterialTheme.typography.headlineSmall)
                    Row {
                        TextButton(onClick = {
                            viewModel.logout()
                            onLogout()
                        }) {
                            Text(LanguageManager.t("Logout"))
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Button(
                    onClick = { onNavigate(ManageLeaves) },
                    modifier = Modifier.fillMaxWidth().height(56.dp)
                ) {
                    Text(LanguageManager.t("Manage Leave Requests"))
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Button(
                    onClick = { onNavigate(com.example.attendanceapp.MonthlyReport) },
                    modifier = Modifier.fillMaxWidth().height(56.dp)
                ) {
                    Text(LanguageManager.t("View Monthly Report"))
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Text(LanguageManager.t("Employees"), style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))
                
                if (employees.isEmpty()) {
                    Text(LanguageManager.t("No employees found."))
                } else {
                    LazyColumn {
                        items(employees) { empId ->
                            val empSettings = viewModel.getEmployeeSettings(empId)
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                                    .animateContentSize()
                                    .clickable { onNavigate(AdminEmployeeDetail(empId)) }
                            ) {
                                Row(
                                    modifier = Modifier.padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    if (empSettings.profilePhotoUri.isNotEmpty()) {
                                        AsyncImage(
                                            model = viewModel.parseImageModel(empSettings.profilePhotoUri),
                                            contentDescription = "Profile Photo",
                                            modifier = Modifier.size(50.dp).clip(CircleShape),
                                            contentScale = ContentScale.Crop
                                        )
                                    } else {
                                        Box(
                                            modifier = Modifier
                                                .size(50.dp)
                                                .clip(CircleShape)
                                                .background(MaterialTheme.colorScheme.secondary),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                empId.firstOrNull()?.uppercase() ?: "?",
                                                color = MaterialTheme.colorScheme.onSecondary
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(16.dp))
                                    Column {
                                        Text(
                                            text = if (empSettings.displayName.isNotBlank()) empSettings.displayName else empId,
                                            style = MaterialTheme.typography.titleMedium
                                        )
                                        if (empSettings.displayName.isNotBlank()) {
                                            Text(text = empId, style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
