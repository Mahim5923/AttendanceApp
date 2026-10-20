package com.example.attendanceapp.data

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.tasks.await
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.util.UUID
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.example.attendanceapp.R
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.Filter
import com.google.firebase.firestore.FirebaseFirestoreException
import android.util.Log

class FirebaseDataRepositoryImpl(private val context: Context) : DataRepository {
    private val prefs: SharedPreferences = context.getSharedPreferences("attendance_prefs", Context.MODE_PRIVATE)
    private val db = FirebaseFirestore.getInstance(FirebaseApp.getInstance(), "attend")
    private val storage = FirebaseStorage.getInstance()
    
    private val _attendances = MutableStateFlow<List<Attendance>>(emptyList())
    override val attendances: StateFlow<List<Attendance>> = _attendances
    
    private val _settings = MutableStateFlow<List<EmployeeSettings>>(emptyList())
    override val settings: StateFlow<List<EmployeeSettings>> = _settings

    private val _leaveRequests = MutableStateFlow<List<LeaveRequest>>(emptyList())
    override val leaveRequests: StateFlow<List<LeaveRequest>> = _leaveRequests

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    override val messages: StateFlow<List<ChatMessage>> = _messages

    private val _appConfig = MutableStateFlow<AppConfig?>(null)
    override val appConfig: StateFlow<AppConfig?> = _appConfig

    private val _branches = MutableStateFlow<List<Branch>>(emptyList())
    override val branches: StateFlow<List<Branch>> = _branches

    override var currentLoggedInUser: String? = prefs.getString("currentLoggedInUser", null)
    override var isAdmin: Boolean = prefs.getBoolean("isAdmin", false)
    
    private var configListener: com.google.firebase.firestore.ListenerRegistration? = null
    private var attendancesListener: com.google.firebase.firestore.ListenerRegistration? = null
    private var settingsListener: com.google.firebase.firestore.ListenerRegistration? = null
    private var leaveRequestsListener: com.google.firebase.firestore.ListenerRegistration? = null
    private var messagesListener: com.google.firebase.firestore.ListenerRegistration? = null
    private var branchesListener: com.google.firebase.firestore.ListenerRegistration? = null

    init {
        setupConfigListener()
        setupListeners()
    }

    private fun handleFirestoreError(error: FirebaseFirestoreException?) {
        if (error == null) return
        Log.e("FirebaseDataRepo", "Firestore error (${error.code}): ${error.message}")
    }

    private fun setupConfigListener() {
        configListener?.remove()
        configListener = db.collection("config").document("appInfo").addSnapshotListener { snapshot, error ->
            if (error != null) {
                handleFirestoreError(error)
                return@addSnapshotListener
            }
            if (snapshot != null && snapshot.exists()) {
                val config = AppConfig(
                    latestVersionCode = snapshot.getLong("latestVersionCode")?.toInt() ?: 1,
                    updateUrl = snapshot.getString("updateUrl") ?: ""
                )
                _appConfig.value = config
            }
        }
    }

    private fun setupListeners() {
        attendancesListener?.remove()
        settingsListener?.remove()
        leaveRequestsListener?.remove()
        messagesListener?.remove()
        branchesListener?.remove()

        branchesListener = db.collection("branches").addSnapshotListener { snapshot, error ->
            if (error != null) {
                handleFirestoreError(error)
                return@addSnapshotListener
            }
            if (snapshot != null) {
                val list = snapshot.documents.mapNotNull { doc ->
                    try {
                        Branch(
                            id = doc.id,
                            name = doc.getString("name") ?: doc.id,
                            checkInTimeHours = doc.getLong("checkInTimeHours")?.toInt() ?: 9,
                            checkInTimeMinutes = doc.getLong("checkInTimeMinutes")?.toInt() ?: 0,
                            checkOutTimeHours = doc.getLong("checkOutTimeHours")?.toInt() ?: 17,
                            checkOutTimeMinutes = doc.getLong("checkOutTimeMinutes")?.toInt() ?: 0,
                            targetLatitude = doc.getDouble("targetLatitude") ?: 0.0,
                            targetLongitude = doc.getDouble("targetLongitude") ?: 0.0,
                            targetRadiusMeters = doc.getDouble("targetRadiusMeters") ?: 100.0
                        )
                    } catch (e: Exception) { null }
                }
                _branches.value = list
            }
        }

        val user = currentLoggedInUser ?: return

        val attendancesQuery = if (isAdmin) db.collection("attendances") else db.collection("attendances").whereEqualTo("employeeId", user)
        attendancesListener = attendancesQuery.addSnapshotListener { snapshot, error ->
            if (error != null) {
                handleFirestoreError(error)
                return@addSnapshotListener
            }
            if (snapshot != null) {
                val list = snapshot.documents.mapNotNull { 
                    try {
                        Attendance(
                            id = it.getString("id") ?: "",
                            employeeId = it.getString("employeeId") ?: "",
                            timestamp = it.getLong("timestamp") ?: 0L,
                            latitude = it.getDouble("latitude") ?: 0.0,
                            longitude = it.getDouble("longitude") ?: 0.0,
                            photoUri = it.getString("photoUri") ?: "",
                            type = AttendanceType.valueOf(it.getString("type") ?: "IN")
                        )
                    } catch (e: Exception) { null }
                }.sortedByDescending { it.timestamp }
                _attendances.value = list
            }
        }

        val settingsQuery = if (isAdmin) db.collection("settings") else db.collection("settings").whereEqualTo("employeeId", user)
        settingsListener = settingsQuery.addSnapshotListener { snapshot, error ->
            if (error != null) {
                handleFirestoreError(error)
                return@addSnapshotListener
            }
            if (snapshot != null) {
                val list = snapshot.documents.mapNotNull { 
                    try {
                        EmployeeSettings(
                            employeeId = it.getString("employeeId") ?: "",
                            displayName = it.getString("displayName") ?: "",
                            profilePhotoUri = it.getString("profilePhotoUri") ?: "",
                            baseSalary = it.getDouble("baseSalary") ?: 0.0,
                            branch = it.getString("branch") ?: "",
                            checkInTimeHours = it.getLong("checkInTimeHours")?.toInt() ?: 9,
                            checkInTimeMinutes = it.getLong("checkInTimeMinutes")?.toInt() ?: 0,
                            checkOutTimeHours = it.getLong("checkOutTimeHours")?.toInt() ?: 17,
                            checkOutTimeMinutes = it.getLong("checkOutTimeMinutes")?.toInt() ?: 0,
                            weekOffs = (it.get("weekOffs") as? List<*>)?.mapNotNull { num -> (num as? Number)?.toInt() } ?: listOf(1, 7), // Sun, Sat
                            targetLatitude = it.getDouble("targetLatitude") ?: 0.0,
                            targetLongitude = it.getDouble("targetLongitude") ?: 0.0,
                            targetRadiusMeters = it.getDouble("targetRadiusMeters") ?: 100.0
                        )
                    } catch (e: Exception) { null }
                }
                _settings.value = list
            }
        }

        val leaveQuery = if (isAdmin) db.collection("leaveRequests") else db.collection("leaveRequests").whereEqualTo("employeeId", user)
        leaveRequestsListener = leaveQuery.addSnapshotListener { snapshot, error ->
            if (error != null) {
                handleFirestoreError(error)
                return@addSnapshotListener
            }
            if (snapshot != null) {
                val list = snapshot.documents.mapNotNull { 
                    try {
                        LeaveRequest(
                            id = it.getString("id") ?: "",
                            employeeId = it.getString("employeeId") ?: "",
                            dateTimestamp = it.getLong("dateTimestamp") ?: 0L,
                            reason = it.getString("reason") ?: "",
                            requestedAtTimestamp = it.getLong("requestedAtTimestamp") ?: 0L,
                            status = LeaveStatus.valueOf(it.getString("status") ?: "PENDING")
                        )
                    } catch (e: Exception) { null }
                }.sortedByDescending { it.requestedAtTimestamp }
                _leaveRequests.value = list
            }
        }

        val messagesQuery = if (isAdmin) {
            db.collection("messages")
        } else {
            db.collection("messages").where(Filter.or(
                Filter.equalTo("senderId", user),
                Filter.equalTo("receiverId", user)
            ))
        }
        messagesListener = messagesQuery.addSnapshotListener { snapshot, error ->
            if (error != null) {
                handleFirestoreError(error)
                return@addSnapshotListener
            }
            if (snapshot != null) {
                val list = snapshot.documents.mapNotNull { 
                    try {
                        ChatMessage(
                            id = it.getString("id") ?: "",
                            senderId = it.getString("senderId") ?: "",
                            receiverId = it.getString("receiverId") ?: "",
                            content = it.getString("content") ?: "",
                            timestamp = it.getLong("timestamp") ?: 0L,
                            isRead = it.getBoolean("isRead") ?: false
                        )
                    } catch (e: Exception) { null }
                }.sortedBy { it.timestamp }
                
                val currentMessages = _messages.value
                val newMessagesForMe = list.filter { newMsg -> 
                    newMsg.receiverId == currentLoggedInUser && 
                    !newMsg.isRead && 
                    currentMessages.none { it.id == newMsg.id }
                }
                
                newMessagesForMe.forEach {
                    showNotification("New Message from ${it.senderId}", it.content)
                }
                
                _messages.value = list
            }
        }
    }
    
    private fun showNotification(title: String, content: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "chat_notifications"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Chat Notifications", NotificationManager.IMPORTANCE_HIGH)
            notificationManager.createNotificationChannel(channel)
        }
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.logo)
            .setContentTitle(title)
            .setContentText(content)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        notificationManager.notify((System.currentTimeMillis() % 10000).toInt(), notification)
    }

    private suspend fun <T> runWithDb(action: suspend (FirebaseFirestore) -> T): T {
        return try {
            action(db)
        } catch (e: FirebaseFirestoreException) {
            handleFirestoreError(e)
            action(db)
        }
    }

    override suspend fun sendMessage(message: ChatMessage) {
        val id = UUID.randomUUID().toString()
        val finalMessage = message.copy(id = id, timestamp = System.currentTimeMillis())
        runWithDb { firestore ->
            firestore.collection("messages").document(id).set(finalMessage).await()
        }
    }

    override suspend fun markMessageAsRead(messageId: String) {
        runWithDb { firestore ->
            firestore.collection("messages").document(messageId).update("isRead", true).await()
        }
    }
    
    override fun login(username: String): Boolean {
        currentLoggedInUser = username
        isAdmin = username.lowercase() == "nkjainnilesh@gmail.com" || username.lowercase() == "mahimsinhsingoria@gmail.com"
        prefs.edit()
            .putString("currentLoggedInUser", currentLoggedInUser)
            .putBoolean("isAdmin", isAdmin)
            .apply()
        setupListeners()
        return true
    }
    
    override fun logout() {
        currentLoggedInUser = null
        isAdmin = false
        prefs.edit()
            .remove("currentLoggedInUser")
            .remove("isAdmin")
            .apply()
        attendancesListener?.remove()
        settingsListener?.remove()
        leaveRequestsListener?.remove()
        messagesListener?.remove()
        branchesListener?.remove()
        _attendances.value = emptyList()
        _settings.value = emptyList()
        _leaveRequests.value = emptyList()
        _messages.value = emptyList()
        _branches.value = emptyList()
    }

    private suspend fun uploadImageIfLocal(uriString: String): String = withContext(Dispatchers.IO) {
        if (uriString.isBlank() || uriString.startsWith("http") || uriString.startsWith("data:")) return@withContext uriString
        
        try {
            val uri = Uri.parse(uriString)
            val inputStream = context.contentResolver.openInputStream(uri)
            val originalBitmap = BitmapFactory.decodeStream(inputStream)
            inputStream?.close()

            if (originalBitmap == null) return@withContext uriString

            // Scale down to max 400x400
            val maxDim = 400f
            val scale = Math.min(maxDim / originalBitmap.width, maxDim / originalBitmap.height)
            val scaledBitmap = if (scale < 1) {
                Bitmap.createScaledBitmap(originalBitmap, (originalBitmap.width * scale).toInt(), (originalBitmap.height * scale).toInt(), true)
            } else {
                originalBitmap
            }

            val outputStream = ByteArrayOutputStream()
            scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 60, outputStream)
            val byteArray = outputStream.toByteArray()
            val base64 = Base64.encodeToString(byteArray, Base64.NO_WRAP)
            
            "data:image/jpeg;base64,$base64"
        } catch (e: Exception) {
            e.printStackTrace()
            uriString
        }
    }
    
    override suspend fun addAttendance(attendance: Attendance) {
        val remoteUrl = uploadImageIfLocal(attendance.photoUri)
        val toSave = attendance.copy(photoUri = remoteUrl)
        val map = hashMapOf(
            "id" to toSave.id,
            "employeeId" to toSave.employeeId,
            "timestamp" to toSave.timestamp,
            "latitude" to toSave.latitude,
            "longitude" to toSave.longitude,
            "photoUri" to toSave.photoUri,
            "type" to toSave.type.name
        )
        runWithDb { firestore ->
            firestore.collection("attendances").document(toSave.id).set(map).await()
        }
    }
    
    override fun getEmployeeSettings(employeeId: String): EmployeeSettings {
        val raw = _settings.value.find { it.employeeId == employeeId } ?: EmployeeSettings(employeeId = employeeId)
        if (raw.branch.isNotBlank()) {
            val b = _branches.value.find { it.name.equals(raw.branch, ignoreCase = true) || it.id.equals(raw.branch, ignoreCase = true) }
            if (b != null) {
                return raw.copy(
                    checkInTimeHours = b.checkInTimeHours,
                    checkInTimeMinutes = b.checkInTimeMinutes,
                    checkOutTimeHours = b.checkOutTimeHours,
                    checkOutTimeMinutes = b.checkOutTimeMinutes,
                    targetLatitude = b.targetLatitude,
                    targetLongitude = b.targetLongitude,
                    targetRadiusMeters = b.targetRadiusMeters
                )
            }
        }
        return raw
    }

    override suspend fun saveEmployeeSettings(setting: EmployeeSettings) {
        val remoteUrl = uploadImageIfLocal(setting.profilePhotoUri)
        val toSave = setting.copy(profilePhotoUri = remoteUrl)
        
        runWithDb { firestore ->
            if (isAdmin) {
                val map = hashMapOf(
                    "employeeId" to toSave.employeeId,
                    "displayName" to toSave.displayName,
                    "profilePhotoUri" to toSave.profilePhotoUri,
                    "baseSalary" to toSave.baseSalary,
                    "branch" to toSave.branch,
                    "checkInTimeHours" to toSave.checkInTimeHours,
                    "checkInTimeMinutes" to toSave.checkInTimeMinutes,
                    "checkOutTimeHours" to toSave.checkOutTimeHours,
                    "checkOutTimeMinutes" to toSave.checkOutTimeMinutes,
                    "weekOffs" to toSave.weekOffs,
                    "targetLatitude" to toSave.targetLatitude,
                    "targetLongitude" to toSave.targetLongitude,
                    "targetRadiusMeters" to toSave.targetRadiusMeters
                )
                firestore.collection("settings").document(toSave.employeeId).set(map, SetOptions.merge()).await()
            } else {
                val map = hashMapOf<String, Any>(
                    "employeeId" to toSave.employeeId,
                    "displayName" to toSave.displayName,
                    "profilePhotoUri" to toSave.profilePhotoUri
                )
                firestore.collection("settings").document(toSave.employeeId).set(map, SetOptions.merge()).await()
            }
        }
    }
    
    override fun getAllEmployees(): List<String> {
        val fromSettings = _settings.value.map { it.employeeId }
        val fromAttendances = _attendances.value.map { it.employeeId }.filter { it != "admin" }
        return (fromSettings + fromAttendances).distinct()
    }

    override suspend fun addLeaveRequest(request: LeaveRequest) {
        val map = hashMapOf(
            "id" to request.id,
            "employeeId" to request.employeeId,
            "dateTimestamp" to request.dateTimestamp,
            "reason" to request.reason,
            "status" to request.status.name,
            "requestedAtTimestamp" to request.requestedAtTimestamp
        )
        runWithDb { firestore ->
            firestore.collection("leaveRequests").document(request.id).set(map).await()
        }
    }

    override suspend fun updateLeaveRequestStatus(id: String, status: LeaveStatus) {
        runWithDb { firestore ->
            firestore.collection("leaveRequests").document(id).update(mapOf("status" to status.name)).await()
        }
    }

    override suspend fun saveBranch(branch: Branch) {
        val id = if (branch.id.isBlank()) UUID.randomUUID().toString() else branch.id
        val map = hashMapOf(
            "id" to id,
            "name" to branch.name,
            "checkInTimeHours" to branch.checkInTimeHours,
            "checkInTimeMinutes" to branch.checkInTimeMinutes,
            "checkOutTimeHours" to branch.checkOutTimeHours,
            "checkOutTimeMinutes" to branch.checkOutTimeMinutes,
            "targetLatitude" to branch.targetLatitude,
            "targetLongitude" to branch.targetLongitude,
            "targetRadiusMeters" to branch.targetRadiusMeters,
            "updatedAt" to System.currentTimeMillis()
        )
        runWithDb { firestore ->
            firestore.collection("branches").document(id).set(map, SetOptions.merge()).await()
        }
    }

    override suspend fun deleteBranch(branchId: String) {
        runWithDb { firestore ->
            firestore.collection("branches").document(branchId).delete().await()
        }
    }
}
