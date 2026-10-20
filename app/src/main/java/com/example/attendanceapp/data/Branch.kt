package com.example.attendanceapp.data

import org.json.JSONObject

data class Branch(
    val id: String = "",
    val name: String = "",
    val checkInTimeHours: Int = 9,
    val checkInTimeMinutes: Int = 0,
    val checkOutTimeHours: Int = 17,
    val checkOutTimeMinutes: Int = 0,
    val targetLatitude: Double = 0.0,
    val targetLongitude: Double = 0.0,
    val targetRadiusMeters: Double = 100.0
) {
    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("id", id)
        json.put("name", name)
        json.put("checkInTimeHours", checkInTimeHours)
        json.put("checkInTimeMinutes", checkInTimeMinutes)
        json.put("checkOutTimeHours", checkOutTimeHours)
        json.put("checkOutTimeMinutes", checkOutTimeMinutes)
        json.put("targetLatitude", targetLatitude)
        json.put("targetLongitude", targetLongitude)
        json.put("targetRadiusMeters", targetRadiusMeters)
        return json
    }

    companion object {
        fun fromMap(id: String, map: Map<String, Any?>): Branch {
            return Branch(
                id = id,
                name = map["name"] as? String ?: id,
                checkInTimeHours = (map["checkInTimeHours"] as? Number)?.toInt() ?: 9,
                checkInTimeMinutes = (map["checkInTimeMinutes"] as? Number)?.toInt() ?: 0,
                checkOutTimeHours = (map["checkOutTimeHours"] as? Number)?.toInt() ?: 17,
                checkOutTimeMinutes = (map["checkOutTimeMinutes"] as? Number)?.toInt() ?: 0,
                targetLatitude = (map["targetLatitude"] as? Number)?.toDouble() ?: 0.0,
                targetLongitude = (map["targetLongitude"] as? Number)?.toDouble() ?: 0.0,
                targetRadiusMeters = (map["targetRadiusMeters"] as? Number)?.toDouble() ?: 100.0
            )
        }
    }
}
