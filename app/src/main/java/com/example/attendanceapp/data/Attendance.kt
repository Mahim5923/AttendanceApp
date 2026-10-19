package com.example.attendanceapp.data

enum class AttendanceType {
    IN, OUT, UNKNOWN
}

data class Attendance(
    val id: String,
    val employeeId: String,
    val timestamp: Long,
    val latitude: Double,
    val longitude: Double,
    val photoUri: String,
    val type: AttendanceType = AttendanceType.UNKNOWN
) {
    fun toJson(): org.json.JSONObject {
        val json = org.json.JSONObject()
        json.put("id", id)
        json.put("employeeId", employeeId)
        json.put("timestamp", timestamp)
        json.put("latitude", latitude)
        json.put("longitude", longitude)
        json.put("photoUri", photoUri)
        json.put("type", type.name)
        return json
    }

    companion object {
        fun fromJson(json: org.json.JSONObject): Attendance {
            return Attendance(
                id = json.getString("id"),
                employeeId = json.optString("employeeId", "unknown"),
                timestamp = json.getLong("timestamp"),
                latitude = json.getDouble("latitude"),
                longitude = json.getDouble("longitude"),
                photoUri = json.getString("photoUri"),
                type = AttendanceType.valueOf(json.optString("type", AttendanceType.UNKNOWN.name))
            )
        }
    }
}
