package com.example.attendanceapp.ui.main

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation3.runtime.NavKey
import com.example.attendanceapp.LanguageManager
import com.example.attendanceapp.ChatScreenKey

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(
    viewModel: MainScreenViewModel,
    onNavigate: (NavKey) -> Unit,
    onBack: () -> Unit
) {
    val currentUser = viewModel.getCurrentUser()
    val allEmployees by viewModel.employees.collectAsState(initial = emptyList())
    
    val usersToChatWith = allEmployees.filter { it != currentUser }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Chats") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        if (usersToChatWith.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("No users to chat with.")
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding)
            ) {
                items(usersToChatWith) { empId ->
                    val userSettings = viewModel.getEmployeeSettings(empId)
                    val displayName = if (userSettings.displayName.isNotBlank()) userSettings.displayName else empId
                    ListItem(
                        headlineContent = { Text(displayName) },
                        supportingContent = { Text(empId) },
                        leadingContent = {
                            Icon(Icons.Default.Person, contentDescription = "User", modifier = Modifier.size(40.dp))
                        },
                        modifier = Modifier.clickable {
                            onNavigate(ChatScreenKey(empId, displayName))
                        }
                    )
                    Divider()
                }
            }
        }
    }
}
