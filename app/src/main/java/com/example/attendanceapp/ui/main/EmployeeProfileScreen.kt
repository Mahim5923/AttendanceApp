package com.example.attendanceapp.ui.main

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import coil.compose.AsyncImage

@Composable
fun EmployeeProfileScreen(
    viewModel: MainScreenViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val currentUser = viewModel.getCurrentUser()
    var settings by remember { mutableStateOf(viewModel.getEmployeeSettings(currentUser)) }

    var displayName by remember { mutableStateOf(settings.displayName) }
    var photoUri by remember { mutableStateOf<Uri?>(if (settings.profilePhotoUri.isNotEmpty()) Uri.parse(settings.profilePhotoUri) else null) }
    var tempPhotoUri by remember { mutableStateOf<Uri?>(null) }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && tempPhotoUri != null) {
            photoUri = tempPhotoUri
        } else if (!success) {
            Toast.makeText(context, "Photo capture failed", Toast.LENGTH_SHORT).show()
        }
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            val uri = createTempImageUri(context)
            tempPhotoUri = uri
            cameraLauncher.launch(uri)
        } else {
            Toast.makeText(context, "Camera permission required", Toast.LENGTH_SHORT).show()
        }
    }

    Column(
        modifier = modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("My Profile", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(32.dp))

        if (photoUri != null) {
            AsyncImage(
                model = viewModel.parseImageModel(photoUri.toString()),
                contentDescription = "Profile Photo",
                modifier = Modifier.size(120.dp).clip(CircleShape),
                contentScale = ContentScale.Crop
            )
        } else {
            Box(
                modifier = Modifier.size(120.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("No Photo")
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Button(onClick = {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                val uri = createTempImageUri(context)
                tempPhotoUri = uri
                cameraLauncher.launch(uri)
            } else {
                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        }) {
            Text("Take Profile Photo")
        }

        Spacer(modifier = Modifier.height(32.dp))

        OutlinedTextField(
            value = displayName,
            onValueChange = { displayName = it },
            label = { Text("Display Name") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = {
                val newSettings = settings.copy(
                    displayName = displayName,
                    profilePhotoUri = photoUri?.toString() ?: ""
                )
                viewModel.saveEmployeeSettings(newSettings)
                Toast.makeText(context, "Profile Saved!", Toast.LENGTH_SHORT).show()
                onNavigateBack()
            },
            modifier = Modifier.fillMaxWidth().height(56.dp)
        ) {
            Text("Save Profile")
        }
    }
}
