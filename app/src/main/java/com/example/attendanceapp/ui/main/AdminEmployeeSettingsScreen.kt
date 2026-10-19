package com.example.attendanceapp.ui.main

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.util.Calendar
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import android.location.Geocoder
import android.widget.Toast
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput

@Composable
fun AdminEmployeeSettingsScreen(
    employeeId: String,
    viewModel: MainScreenViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isMapTouched by remember { mutableStateOf(false) }
    var settings by remember { mutableStateOf(viewModel.getEmployeeSettings(employeeId)) }
    
    var baseSalaryStr by remember { mutableStateOf(settings.baseSalary.toString()) }
    var checkInH by remember { mutableStateOf(settings.checkInTimeHours.toString()) }
    var checkInM by remember { mutableStateOf(settings.checkInTimeMinutes.toString()) }
    var checkOutH by remember { mutableStateOf(settings.checkOutTimeHours.toString()) }
    var checkOutM by remember { mutableStateOf(settings.checkOutTimeMinutes.toString()) }

    // Week Off States
    var isSundayOff by remember { mutableStateOf(settings.weekOffs.contains(Calendar.SUNDAY)) }
    var isMondayOff by remember { mutableStateOf(settings.weekOffs.contains(Calendar.MONDAY)) }
    var isTuesdayOff by remember { mutableStateOf(settings.weekOffs.contains(Calendar.TUESDAY)) }
    var isWednesdayOff by remember { mutableStateOf(settings.weekOffs.contains(Calendar.WEDNESDAY)) }
    var isThursdayOff by remember { mutableStateOf(settings.weekOffs.contains(Calendar.THURSDAY)) }
    var isFridayOff by remember { mutableStateOf(settings.weekOffs.contains(Calendar.FRIDAY)) }
    var isSaturdayOff by remember { mutableStateOf(settings.weekOffs.contains(Calendar.SATURDAY)) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState(), enabled = !isMapTouched)
    ) {
        Text("Settings: $employeeId", style = MaterialTheme.typography.headlineSmall)
        Spacer(modifier = Modifier.height(16.dp))
        
        OutlinedTextField(
            value = baseSalaryStr,
            onValueChange = { baseSalaryStr = it },
            label = { Text("Base Salary (₹)") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = checkInH,
                onValueChange = { checkInH = it },
                label = { Text("Check-In Hour (24h)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = checkInM,
                onValueChange = { checkInM = it },
                label = { Text("Min") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = checkOutH,
                onValueChange = { checkOutH = it },
                label = { Text("Check-Out Hour (24h)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = checkOutM,
                onValueChange = { checkOutM = it },
                label = { Text("Min") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
        }
        Spacer(modifier = Modifier.height(16.dp))
        
        Text("Select Week Offs:", style = MaterialTheme.typography.titleMedium)
        
        @Composable
        fun WeekOffCheckbox(label: String, isChecked: Boolean, onCheckedChange: (Boolean) -> Unit) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Checkbox(checked = isChecked, onCheckedChange = onCheckedChange)
                Text(label)
            }
        }

        WeekOffCheckbox("Monday", isMondayOff) { isMondayOff = it }
        WeekOffCheckbox("Tuesday", isTuesdayOff) { isTuesdayOff = it }
        WeekOffCheckbox("Wednesday", isWednesdayOff) { isWednesdayOff = it }
        WeekOffCheckbox("Thursday", isThursdayOff) { isThursdayOff = it }
        WeekOffCheckbox("Friday", isFridayOff) { isFridayOff = it }
        WeekOffCheckbox("Saturday", isSaturdayOff) { isSaturdayOff = it }
        WeekOffCheckbox("Sunday", isSundayOff) { isSundayOff = it }
        
        Spacer(modifier = Modifier.height(16.dp))
        Text("Location Settings:", style = MaterialTheme.typography.titleMedium)
        
        var targetLat by remember { mutableStateOf(settings.targetLatitude.toString()) }
        var targetLon by remember { mutableStateOf(settings.targetLongitude.toString()) }
        var targetRadius by remember { mutableStateOf(settings.targetRadiusMeters.toString()) }
        
        var searchQuery by remember { mutableStateOf("") }
        val context = LocalContext.current
        val coroutineScope = rememberCoroutineScope()
        
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                label = { Text("Search Address") },
                modifier = Modifier.weight(1f)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Button(onClick = {
                if (searchQuery.isNotBlank()) {
                    coroutineScope.launch(Dispatchers.IO) {
                        try {
                            val geocoder = Geocoder(context, java.util.Locale.getDefault())
                            val addresses = geocoder.getFromLocationName(searchQuery, 1)
                            if (!addresses.isNullOrEmpty()) {
                                val location = addresses[0]
                                targetLat = location.latitude.toString()
                                targetLon = location.longitude.toString()
                            } else {
                                withContext(Dispatchers.Main) {
                                    Toast.makeText(context, "Address not found", Toast.LENGTH_SHORT).show()
                                }
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                            withContext(Dispatchers.Main) {
                                Toast.makeText(context, "Search failed", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                }
            }) {
                Text("Search")
            }
        }
        
        val latD = targetLat.toDoubleOrNull() ?: 0.0
        val lonD = targetLon.toDoubleOrNull() ?: 0.0
        val mapLocation = com.google.android.gms.maps.model.LatLng(if (latD != 0.0) latD else 20.5937, if (lonD != 0.0) lonD else 78.9629)

        val cameraPositionState = com.google.maps.android.compose.rememberCameraPositionState {
            position = com.google.android.gms.maps.model.CameraPosition.fromLatLngZoom(mapLocation, if (latD != 0.0) 15f else 4f)
        }
        
        LaunchedEffect(latD, lonD) {
            if (latD != 0.0 || lonD != 0.0) {
                cameraPositionState.animate(
                    com.google.android.gms.maps.CameraUpdateFactory.newLatLngZoom(
                        com.google.android.gms.maps.model.LatLng(latD, lonD), 15f
                    )
                )
            }
        }

        Box(modifier = Modifier
            .fillMaxWidth()
            .height(250.dp)
            .padding(vertical = 8.dp)
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        when (event.type) {
                            PointerEventType.Press -> {
                                isMapTouched = true
                            }
                            PointerEventType.Release -> {
                                isMapTouched = false
                            }
                        }
                    }
                }
            }
        ) {
            com.google.maps.android.compose.GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraPositionState,
                onMapClick = { latLng ->
                    targetLat = latLng.latitude.toString()
                    targetLon = latLng.longitude.toString()
                }
            ) {
                if (latD != 0.0 || lonD != 0.0) {
                    com.google.maps.android.compose.Marker(
                        state = com.google.maps.android.compose.MarkerState(position = com.google.android.gms.maps.model.LatLng(latD, lonD)),
                        title = "Target Location"
                    )
                }
            }
        }
        
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = targetLat,
                onValueChange = { targetLat = it },
                label = { Text("Target Latitude") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = targetLon,
                onValueChange = { targetLon = it },
                label = { Text("Target Longitude") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(
            value = targetRadius,
            onValueChange = { targetRadius = it },
            label = { Text("Target Radius (Meters)") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth()
        )
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Button(
            onClick = {
                val newWeekOffs = mutableListOf<Int>()
                if (isSundayOff) newWeekOffs.add(Calendar.SUNDAY)
                if (isMondayOff) newWeekOffs.add(Calendar.MONDAY)
                if (isTuesdayOff) newWeekOffs.add(Calendar.TUESDAY)
                if (isWednesdayOff) newWeekOffs.add(Calendar.WEDNESDAY)
                if (isThursdayOff) newWeekOffs.add(Calendar.THURSDAY)
                if (isFridayOff) newWeekOffs.add(Calendar.FRIDAY)
                if (isSaturdayOff) newWeekOffs.add(Calendar.SATURDAY)
                
                val newSettings = settings.copy(
                    baseSalary = baseSalaryStr.toDoubleOrNull() ?: 0.0,
                    checkInTimeHours = checkInH.toIntOrNull() ?: 9,
                    checkInTimeMinutes = checkInM.toIntOrNull() ?: 0,
                    checkOutTimeHours = checkOutH.toIntOrNull() ?: 17,
                    checkOutTimeMinutes = checkOutM.toIntOrNull() ?: 0,
                    weekOffs = newWeekOffs,
                    targetLatitude = targetLat.toDoubleOrNull() ?: 0.0,
                    targetLongitude = targetLon.toDoubleOrNull() ?: 0.0,
                    targetRadiusMeters = targetRadius.toDoubleOrNull() ?: 100.0
                )
                viewModel.saveEmployeeSettings(newSettings)
                onNavigateBack()
            },
            modifier = Modifier.fillMaxWidth().height(56.dp)
        ) {
            Text("Save Settings")
        }
    }
}
