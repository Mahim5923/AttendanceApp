package com.example.attendanceapp.data

import org.json.JSONArray
import org.json.JSONObject

data class EmployeeSettings(
    val employeeId: String,
    val displayName: String = "",
    val profilePhotoUri: String = "",
    val baseSalary: Double = 0.0,
    val branch: String = "",
    val checkInTimeHours: Int = 9,
    val checkInTimeMinutes: Int = 0,
    val checkOutTimeHours: Int = 17,
    val checkOutTimeMinutes: Int = 0,
    val weekOffs: List<Int> = listOf(1), // 1 = Sunday, 7 = Saturday in Calendar (Calendar.SUNDAY = 1)
    val targetLatitude: Double = 0.0,
    val targetLongitude: Double = 0.0,
    val targetRadiusMeters: Double = 100.0
) {
    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("employeeId", employeeId)
        json.put("displayName", displayName)
        json.put("profilePhotoUri", profilePhotoUri)
        json.put("baseSalary", baseSalary)
        json.put("branch", branch)
        json.put("checkInTimeHours", checkInTimeHours)
        json.put("checkInTimeMinutes", checkInTimeMinutes)
        json.put("checkOutTimeHours", checkOutTimeHours)
        json.put("checkOutTimeMinutes", checkOutTimeMinutes)
        json.put("targetLatitude", targetLatitude)
        json.put("targetLongitude", targetLongitude)
        json.put("targetRadiusMeters", targetRadiusMeters)
        
        val weekOffArray = JSONArray()
        weekOffs.forEach { weekOffArray.put(it) }
        json.put("weekOffs", weekOffArray)
        
        return json
    }

    companion object {
        fun fromJson(json: JSONObject): EmployeeSettings {
            val weekOffArray = json.optJSONArray("weekOffs") ?: JSONArray()
            val weekOffsList = mutableListOf<Int>()
            for (i in 0 until weekOffArray.length()) {
                weekOffsList.add(weekOffArray.getInt(i))
            }
            
            return EmployeeSettings(
                employeeId = json.getString("employeeId"),
                displayName = json.optString("displayName", ""),
                profilePhotoUri = json.optString("profilePhotoUri", ""),
                baseSalary = json.optDouble("baseSalary", 0.0),
                branch = json.optString("branch", ""),
                checkInTimeHours = json.optInt("checkInTimeHours", 9),
                checkInTimeMinutes = json.optInt("checkInTimeMinutes", 0),
                checkOutTimeHours = json.optInt("checkOutTimeHours", 17),
                checkOutTimeMinutes = json.optInt("checkOutTimeMinutes", 0),
                weekOffs = if (weekOffsList.isEmpty()) listOf(1) else weekOffsList,
                targetLatitude = json.optDouble("targetLatitude", 0.0),
                targetLongitude = json.optDouble("targetLongitude", 0.0),
                targetRadiusMeters = json.optDouble("targetRadiusMeters", 100.0)
            )
        }
    }
}
