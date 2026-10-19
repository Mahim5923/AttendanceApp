package com.example.attendanceapp.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.example.attendanceapp.data.ChatMessage
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    viewModel: MainScreenViewModel,
    chatPartnerId: String,
    chatPartnerName: String,
    onBack: () -> Unit
) {
    val currentUser = viewModel.getCurrentUser()
    val allMessages by viewModel.messages.collectAsState(initial = emptyList())
    
    // Filter messages for this conversation
    val conversation = allMessages.filter { 
        (it.senderId == currentUser && it.receiverId == chatPartnerId) || 
        (it.senderId == chatPartnerId && it.receiverId == currentUser)
    }.sortedBy { it.timestamp }

    var text by remember { mutableStateOf("") }
    val coroutineScope = rememberCoroutineScope()

    // Mark messages as read
    LaunchedEffect(conversation) {
        conversation.filter { it.receiverId == currentUser && !it.isRead }.forEach {
            viewModel.markMessageAsRead(it.id)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(chatPartnerName) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        bottomBar = {
            Surface(tonalElevation = 8.dp) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = text,
                        onValueChange = { text = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("Message...") },
                        shape = RoundedCornerShape(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    IconButton(
                        onClick = {
                            if (text.isNotBlank()) {
                                val msg = ChatMessage(
                                    senderId = currentUser,
                                    receiverId = chatPartnerId,
                                    content = text.trim()
                                )
                                coroutineScope.launch {
                                    viewModel.sendMessage(msg)
                                }
                                text = ""
                            }
                        },
                        colors = IconButtonDefaults.iconButtonColors(contentColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Icon(Icons.Default.Send, contentDescription = "Send")
                    }
                }
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            contentPadding = PaddingValues(vertical = 16.dp),
            reverseLayout = false
        ) {
            items(conversation) { msg ->
                val isMine = msg.senderId == currentUser
                val format = SimpleDateFormat("HH:mm", Locale.getDefault())
                val time = format.format(Date(msg.timestamp))

                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = if (isMine) Alignment.CenterEnd else Alignment.CenterStart
                ) {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = if (isMine) Color.Red else MaterialTheme.colorScheme.secondaryContainer,
                        modifier = Modifier.padding(vertical = 4.dp).widthIn(max = 280.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = msg.content, 
                                style = MaterialTheme.typography.bodyLarge,
                                color = if (isMine) Color.White else MaterialTheme.colorScheme.onSecondaryContainer
                            )
                            Text(
                                text = time, 
                                style = MaterialTheme.typography.bodySmall, 
                                modifier = Modifier.align(Alignment.End),
                                color = if (isMine) Color.White.copy(alpha = 0.7f) else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}
