package com.example.attendanceapp.ui.main

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Looper
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.example.attendanceapp.data.Attendance
import com.example.attendanceapp.data.AttendanceType
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.io.File
import java.util.UUID

@Composable
fun MarkAttendanceScreen(
    attendanceTypeStr: String,
    viewModel: MainScreenViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var photoUri by remember { mutableStateOf<Uri?>(null) }
    var locationFetched by remember { mutableStateOf(false) }
    var latitude by remember { mutableStateOf(0.0) }
    var longitude by remember { mutableStateOf(0.0) }

    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }
    
    val aType = try { AttendanceType.valueOf(attendanceTypeStr) } catch(e:Exception) { AttendanceType.UNKNOWN }

    val settings = remember { viewModel.getEmployeeSettings(viewModel.getCurrentUser()) }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && photoUri != null) {
            val attendance = Attendance(
                id = UUID.randomUUID().toString(),
                employeeId = viewModel.getCurrentUser(),
                timestamp = System.currentTimeMillis(),
                latitude = latitude,
                longitude = longitude,
                photoUri = photoUri.toString(),
                type = aType
            )
            viewModel.addAttendance(attendance)
            Toast.makeText(context, "$aType Marked!", Toast.LENGTH_SHORT).show()
            onNavigateBack()
        } else {
            Toast.makeText(context, "Photo capture failed", Toast.LENGTH_SHORT).show()
        }
    }

    val handleLocationReceived: (Double, Double) -> Unit = { lat, lon ->
        val results = FloatArray(1)
        android.location.Location.distanceBetween(lat, lon, settings.targetLatitude, settings.targetLongitude, results)
        val distance = results[0]
        
        if ((settings.targetLatitude == 0.0 && settings.targetLongitude == 0.0) || distance <= settings.targetRadiusMeters) {
            latitude = lat
            longitude = lon
            locationFetched = true
            photoUri = createTempImageUri(context)
            cameraLauncher.launch(photoUri!!)
        } else {
            Toast.makeText(context, "You are too far from the attendance location. Distance: ${distance.toInt()}m", Toast.LENGTH_LONG).show()
        }
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseLocationGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        
        if (fineLocationGranted || coarseLocationGranted) {
            fetchLocation(fusedLocationClient, handleLocationReceived)
        } else {
            Toast.makeText(context, "Location permission required", Toast.LENGTH_SHORT).show()
        }
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            if (hasLocationPermissions(context)) {
                fetchLocation(fusedLocationClient, handleLocationReceived)
            } else {
                locationPermissionLauncher.launch(
                    arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                )
            }
        } else {
            Toast.makeText(context, "Camera permission required", Toast.LENGTH_SHORT).show()
        }
    }

    Column(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Mark $aType", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(32.dp))
        Button(
            onClick = {
                val calendar = java.util.Calendar.getInstance()
                val currentDayOfWeek = calendar.get(java.util.Calendar.DAY_OF_WEEK)
                if (settings.weekOffs.contains(currentDayOfWeek)) {
                    Toast.makeText(context, "You cannot mark attendance on your week off", Toast.LENGTH_LONG).show()
                    return@Button
                }

                if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    if (hasLocationPermissions(context)) {
                        fetchLocation(fusedLocationClient, handleLocationReceived)
                    } else {
                        locationPermissionLauncher.launch(
                            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                        )
                    }
                } else {
                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                }
            },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 32.dp).height(56.dp)
        ) {
            Text("Take Photo & Mark Location")
        }
    }
}

private fun hasLocationPermissions(context: Context): Boolean {
    return ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_COARSE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
}

fun createTempImageUri(context: Context): Uri {
    val tempFile = File.createTempFile("attendance_photo_", ".jpg", context.cacheDir).apply {
        createNewFile()
    }
    return FileProvider.getUriForFile(
        context,
        "${context.packageName}.provider",
        tempFile
    )
}

@SuppressLint("MissingPermission")
private fun fetchLocation(
    fusedLocationClient: FusedLocationProviderClient,
    onLocationReceived: (Double, Double) -> Unit
) {
    fusedLocationClient.lastLocation.addOnSuccessListener { location ->
        if (location != null) {
            onLocationReceived(location.latitude, location.longitude)
        } else {
            val locationRequest = LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 1000L
            ).setMaxUpdates(1).build()

            val locationCallback = object : LocationCallback() {
                override fun onLocationResult(locationResult: LocationResult) {
                    val lastLoc = locationResult.lastLocation
                    if (lastLoc != null) {
                        onLocationReceived(lastLoc.latitude, lastLoc.longitude)
                    } else {
                        onLocationReceived(0.0, 0.0)
                    }
                    fusedLocationClient.removeLocationUpdates(this)
                }
            }

            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        }
    }.addOnFailureListener {
        onLocationReceived(0.0, 0.0)
    }
}

