package com.example.attendanceapp.data

data class ChatMessage(
    val id: String = "",
    val senderId: String = "",
    val receiverId: String = "",
    val content: String = "",
    val timestamp: Long = 0L,
    val isRead: Boolean = false
)
