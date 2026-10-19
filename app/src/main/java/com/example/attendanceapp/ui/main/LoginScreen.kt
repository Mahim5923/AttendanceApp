package com.example.attendanceapp.ui.main

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.navigation3.runtime.NavKey
import androidx.compose.foundation.Image
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.ContentScale
import com.example.attendanceapp.R
import com.example.attendanceapp.AdminDashboard
import com.example.attendanceapp.EmployeeDashboard
import com.example.attendanceapp.LanguageManager
import kotlinx.coroutines.launch
import androidx.compose.ui.graphics.Color
import com.example.attendanceapp.theme.AttendanceAppTheme

@Composable
fun LoginScreen(
    viewModel: MainScreenViewModel,
    onNavigate: (NavKey) -> Unit,
    modifier: Modifier = Modifier
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current
    
    val performLogin = {
        if (email.isNotBlank() && password.isNotBlank()) {
            isLoading = true
            coroutineScope.launch {
                val result = viewModel.login(email.trim(), password)
                isLoading = false
                if (result.isSuccess) {
                    if (viewModel.isAdmin()) {
                        onNavigate(AdminDashboard)
                    } else {
                        onNavigate(EmployeeDashboard)
                    }
                } else {
                    Toast.makeText(context, "Login Failed: ${result.exceptionOrNull()?.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    AttendanceAppTheme {
        Surface(
            modifier = modifier.fillMaxSize(),
            color = Color.White
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(32.dp).align(Alignment.Center).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
        Image(
            painter = painterResource(id = R.drawable.logo),
            contentDescription = "App Logo",
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp),
            contentScale = ContentScale.Crop
        )
        Spacer(modifier = Modifier.height(32.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text(LanguageManager.t("Email")) },
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next)
        )
        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text(LanguageManager.t("Password")) },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { performLogin() })
        )
        Spacer(modifier = Modifier.height(32.dp))

        if (isLoading) {
            CircularProgressIndicator()
        } else {
            Button(
                onClick = { performLogin() },
                modifier = Modifier.fillMaxWidth().height(56.dp)
            ) {
                Text(LanguageManager.t("Login"))
            }
        }
        
        Spacer(modifier = Modifier.height(32.dp))
        
        TextButton(
            onClick = { LanguageManager.isHindi = !LanguageManager.isHindi }
        ) {
            Text(if (LanguageManager.isHindi) "English" else "हिंदी", style = MaterialTheme.typography.titleMedium)
        }
                }
            }
        }
    }
}

