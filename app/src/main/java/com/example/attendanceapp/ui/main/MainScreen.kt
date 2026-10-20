package com.example.attendanceapp.ui.main

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.ContentScale
import com.example.attendanceapp.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.delay
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.platform.LocalContext
import android.widget.Toast
import androidx.navigation3.runtime.NavKey
import com.example.attendanceapp.LanguageManager
import com.example.attendanceapp.EmployeeDashboard
import com.example.attendanceapp.EmployeeProfile
import com.example.attendanceapp.MarkAttendance
import com.example.attendanceapp.Calculator
import com.example.attendanceapp.ViewAttendance
import com.example.attendanceapp.RequestLeave
import com.example.attendanceapp.ChatListScreenKey
import com.example.attendanceapp.data.AttendanceType

@Composable
fun MainScreen(
    viewModel: MainScreenViewModel,
    onItemClick: (NavKey) -> Unit,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
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
            FloatingActionButton(
                onClick = { onItemClick(ChatListScreenKey) },
                containerColor = androidx.compose.ui.graphics.Color.Red,
                contentColor = androidx.compose.ui.graphics.Color.White
            ) {
                Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = "Chat")
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
        Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .animateContentSize()
                    .padding(vertical = 32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
            val userDisplayName = viewModel.getEmployeeSettings(viewModel.getCurrentUser()).displayName
            val displayName = if (userDisplayName.isNotBlank()) userDisplayName else viewModel.getCurrentUser()

        var currentTime by remember { mutableStateOf(System.currentTimeMillis()) }
        LaunchedEffect(Unit) {
            while(true) {
                currentTime = System.currentTimeMillis()
                delay(1000)
            }
        }
        val dateFormat = remember { SimpleDateFormat("EEEE, dd MMM yyyy\nhh:mm:ss a", Locale.getDefault()) }
        val timeString = dateFormat.format(Date(currentTime))

        Image(
            painter = painterResource(id = R.drawable.logo),
            contentDescription = "App Logo",
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp),
            contentScale = ContentScale.Crop
        )
        Spacer(modifier = Modifier.height(16.dp))
        
        Text(
            text = timeString, 
            style = MaterialTheme.typography.headlineMedium, 
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(8.dp))
        
        Text(text = "Welcome, $displayName", style = MaterialTheme.typography.bodyLarge)
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 32.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Button(
                onClick = { 
                    val error = viewModel.validateAttendance(AttendanceType.IN)
                    if (error == null) {
                        onItemClick(MarkAttendance(AttendanceType.IN.name))
                    } else {
                        Toast.makeText(context, error, Toast.LENGTH_LONG).show()
                    }
                },
                modifier = Modifier.weight(1f).height(56.dp)
            ) {
                Text(LanguageManager.t("In"))
            }
            Button(
                onClick = { 
                    val error = viewModel.validateAttendance(AttendanceType.OUT)
                    if (error == null) {
                        onItemClick(MarkAttendance(AttendanceType.OUT.name))
                    } else {
                        Toast.makeText(context, error, Toast.LENGTH_LONG).show()
                    }
                },
                modifier = Modifier.weight(1f).height(56.dp)
            ) {
                Text(LanguageManager.t("Out"))
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Button(
            onClick = { onItemClick(ViewAttendance) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 32.dp).height(56.dp)
        ) {
            Text(LanguageManager.t("View My Attendance"))
        }
        
        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = { onItemClick(RequestLeave) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 32.dp).height(56.dp)
        ) {
            Text(LanguageManager.t("Request Leave"))
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Button(
            onClick = { onItemClick(Calculator) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 32.dp).height(56.dp)
        ) {
            Text(LanguageManager.t("Salary Calculator"))
        }
        
        Spacer(modifier = Modifier.height(32.dp))
        
        TextButton(onClick = {
            viewModel.logout()
            onLogout()
        }) {
            Text(LanguageManager.t("Logout"))
        }
            }
            
            Row(modifier = Modifier.align(Alignment.TopEnd).padding(16.dp)) {
                TextButton(onClick = { onItemClick(EmployeeProfile) }) {
                    Text(LanguageManager.t("Edit Profile"))
                }
            }
        }
    }
}
}

