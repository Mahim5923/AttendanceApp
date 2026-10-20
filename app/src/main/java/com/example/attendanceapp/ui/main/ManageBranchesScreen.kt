package com.example.attendanceapp.ui.main

import android.location.Geocoder
import android.widget.Toast
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.attendanceapp.LanguageManager
import com.example.attendanceapp.data.Branch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManageBranchesScreen(
    viewModel: MainScreenViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val branches by viewModel.branches.collectAsState()
    val employees by viewModel.employees.collectAsState()

    var showEditDialog by remember { mutableStateOf(false) }
    var editingBranch by remember { mutableStateOf<Branch?>(null) }
    var branchToDelete by remember { mutableStateOf<Branch?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Manage Branches & Shifts") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    editingBranch = Branch() // new branch
                    showEditDialog = true
                },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Branch")
            }
        },
        modifier = modifier.fillMaxSize()
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp)
        ) {
            Text(
                text = "Group employees into branches. Employees in the same branch share identical shift timings and office location for attendance.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 8.dp)
            )

            Button(
                onClick = {
                    editingBranch = Branch()
                    showEditDialog = true
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Add New Branch", fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (branches.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(top = 40.dp),
                    contentAlignment = Alignment.TopCenter
                ) {
                    Text(
                        "No branches created yet. Tap '+ Add New Branch' to set up your first branch.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 80.dp)
                ) {
                    items(branches) { branch ->
                        val assignedCount = employees.count { empId ->
                            val st = viewModel.getEmployeeSettings(empId)
                            st.branch.equals(branch.name, ignoreCase = true) || st.branch.equals(branch.id, ignoreCase = true)
                        }

                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .animateContentSize(),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = branch.name,
                                            style = MaterialTheme.typography.titleLarge,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Surface(
                                            shape = MaterialTheme.shapes.extraSmall,
                                            color = MaterialTheme.colorScheme.primaryContainer,
                                            modifier = Modifier.padding(top = 4.dp)
                                        ) {
                                            Text(
                                                text = "👥 $assignedCount Assigned",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }

                                    Row {
                                        IconButton(onClick = {
                                            editingBranch = branch
                                            showEditDialog = true
                                        }) {
                                            Icon(Icons.Default.Edit, contentDescription = "Edit Branch", tint = MaterialTheme.colorScheme.primary)
                                        }
                                        IconButton(onClick = {
                                            if (assignedCount > 0) {
                                                Toast.makeText(
                                                    context,
                                                    "Cannot delete: $assignedCount employees assigned to '${branch.name}'. Reassign them first.",
                                                    Toast.LENGTH_LONG
                                                ).show()
                                            } else {
                                                branchToDelete = branch
                                            }
                                        }) {
                                            Icon(Icons.Default.Delete, contentDescription = "Delete Branch", tint = MaterialTheme.colorScheme.error)
                                        }
                                    }
                                }

                                HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "🕒 Shift Schedule:",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Text(
                                        text = String.format(
                                            "%02d:%02d - %02d:%02d",
                                            branch.checkInTimeHours,
                                            branch.checkInTimeMinutes,
                                            branch.checkOutTimeHours,
                                            branch.checkOutTimeMinutes
                                        ),
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }

                                Spacer(modifier = Modifier.height(4.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "📍 Office Geofence:",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Text(
                                        text = if (branch.targetLatitude != 0.0 || branch.targetLongitude != 0.0)
                                            "${String.format("%.4f", branch.targetLatitude)}, ${String.format("%.4f", branch.targetLongitude)} (${branch.targetRadiusMeters.toInt()}m)"
                                        else "Location not configured",
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Delete Confirmation Dialog
    if (branchToDelete != null) {
        val b = branchToDelete!!
        AlertDialog(
            onDismissRequest = { branchToDelete = null },
            title = { Text("Delete Branch") },
            text = { Text("Are you sure you want to delete branch '${b.name}'?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteBranch(b.id)
                        Toast.makeText(context, "Branch '${b.name}' deleted", Toast.LENGTH_SHORT).show()
                        branchToDelete = null
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { branchToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Add / Edit Branch Dialog
    if (showEditDialog && editingBranch != null) {
        BranchEditDialog(
            branch = editingBranch!!,
            onDismiss = {
                showEditDialog = false
                editingBranch = null
            },
            onSave = { updatedBranch ->
                viewModel.saveBranch(updatedBranch)
                Toast.makeText(context, "Branch '${updatedBranch.name}' saved", Toast.LENGTH_SHORT).show()
                showEditDialog = false
                editingBranch = null
            }
        )
    }
}

@Composable
fun BranchEditDialog(
    branch: Branch,
    onDismiss: () -> Unit,
    onSave: (Branch) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var name by remember { mutableStateOf(branch.name) }
    var inH by remember { mutableStateOf(branch.checkInTimeHours.toString()) }
    var inM by remember { mutableStateOf(branch.checkInTimeMinutes.toString()) }
    var outH by remember { mutableStateOf(branch.checkOutTimeHours.toString()) }
    var outM by remember { mutableStateOf(branch.checkOutTimeMinutes.toString()) }
    var latStr by remember { mutableStateOf(branch.targetLatitude.toString()) }
    var lonStr by remember { mutableStateOf(branch.targetLongitude.toString()) }
    var radiusStr by remember { mutableStateOf(branch.targetRadiusMeters.toString()) }
    var searchQuery by remember { mutableStateOf("") }
    var isMapTouched by remember { mutableStateOf(false) }

    val isNew = branch.id.isBlank()

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            shape = MaterialTheme.shapes.large,
            color = MaterialTheme.colorScheme.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState(), enabled = !isMapTouched)
            ) {
                Text(
                    text = if (isNew) "➕ Add New Branch" else "✏️ Edit Branch",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "Employees assigned to this branch will automatically inherit its shift timings and geofenced attendance location.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Branch Name *") },
                    placeholder = { Text("e.g. Headquarters, North Campus") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(16.dp))

                Text("Shift Timings (24-Hour Format)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.height(6.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = inH,
                        onValueChange = { inH = it },
                        label = { Text("Check-In Hour") },
                        placeholder = { Text("9") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = inM,
                        onValueChange = { inM = it },
                        label = { Text("Min") },
                        placeholder = { Text("0") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = outH,
                        onValueChange = { outH = it },
                        label = { Text("Check-Out Hour") },
                        placeholder = { Text("17") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = outM,
                        onValueChange = { outM = it },
                        label = { Text("Min") },
                        placeholder = { Text("0") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                Text("Office Attendance Geofence", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.height(6.dp))

                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        label = { Text("Search Address") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (searchQuery.isNotBlank()) {
                                coroutineScope.launch(Dispatchers.IO) {
                                    try {
                                        val geocoder = Geocoder(context, java.util.Locale.getDefault())
                                        val addresses = geocoder.getFromLocationName(searchQuery, 1)
                                        if (!addresses.isNullOrEmpty()) {
                                            val loc = addresses[0]
                                            latStr = loc.latitude.toString()
                                            lonStr = loc.longitude.toString()
                                        } else {
                                            withContext(Dispatchers.Main) {
                                                Toast.makeText(context, "Address not found", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    } catch (e: Exception) {
                                        withContext(Dispatchers.Main) {
                                            Toast.makeText(context, "Search failed: ${e.message}", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Text("Search")
                    }
                }

                val latD = latStr.toDoubleOrNull() ?: 0.0
                val lonD = lonStr.toDoubleOrNull() ?: 0.0
                val mapLocation = com.google.android.gms.maps.model.LatLng(
                    if (latD != 0.0) latD else 20.5937,
                    if (lonD != 0.0) lonD else 78.9629
                )

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

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .padding(vertical = 8.dp)
                        .pointerInput(Unit) {
                            awaitPointerEventScope {
                                while (true) {
                                    val event = awaitPointerEvent(PointerEventPass.Initial)
                                    when (event.type) {
                                        PointerEventType.Press -> isMapTouched = true
                                        PointerEventType.Release -> isMapTouched = false
                                    }
                                }
                            }
                        }
                ) {
                    com.google.maps.android.compose.GoogleMap(
                        modifier = Modifier.fillMaxSize(),
                        cameraPositionState = cameraPositionState,
                        onMapClick = { latLng ->
                            latStr = latLng.latitude.toString()
                            lonStr = latLng.longitude.toString()
                        }
                    ) {
                        if (latD != 0.0 || lonD != 0.0) {
                            com.google.maps.android.compose.Marker(
                                state = com.google.maps.android.compose.MarkerState(
                                    position = com.google.android.gms.maps.model.LatLng(latD, lonD)
                                ),
                                title = name.ifBlank { "Branch Office" }
                            )
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = latStr,
                        onValueChange = { latStr = it },
                        label = { Text("Latitude") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = lonStr,
                        onValueChange = { lonStr = it },
                        label = { Text("Longitude") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = radiusStr,
                    onValueChange = { radiusStr = it },
                    label = { Text("Allowed Radius (Meters)") },
                    placeholder = { Text("100") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(24.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel")
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Button(
                        onClick = {
                            if (name.isBlank()) {
                                Toast.makeText(context, "Please enter a branch name", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            val id = if (branch.id.isNotBlank()) branch.id else UUID.randomUUID().toString()
                            val updated = Branch(
                                id = id,
                                name = name.trim(),
                                checkInTimeHours = inH.toIntOrNull() ?: 9,
                                checkInTimeMinutes = inM.toIntOrNull() ?: 0,
                                checkOutTimeHours = outH.toIntOrNull() ?: 17,
                                checkOutTimeMinutes = outM.toIntOrNull() ?: 0,
                                targetLatitude = latStr.toDoubleOrNull() ?: 0.0,
                                targetLongitude = lonStr.toDoubleOrNull() ?: 0.0,
                                targetRadiusMeters = radiusStr.toDoubleOrNull() ?: 100.0
                            )
                            onSave(updated)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                        modifier = Modifier.height(48.dp)
                    ) {
                        Text(if (isNew) "Create Branch" else "Save Changes")
                    }
                }
            }
        }
    }
}
