package com.example.attendanceapp.ui.main

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@Composable
fun ForceUpdateScreen(
    updateUrl: String,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    Column(
        modifier = modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Update Required", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.error)
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "A new version of the app is available and required to continue. Please update to the latest version.",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(32.dp))
        Button(
            onClick = {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(updateUrl))
                context.startActivity(intent)
            },
            modifier = Modifier.fillMaxWidth().height(56.dp)
        ) {
            Text("Update Now")
        }
    }
}
