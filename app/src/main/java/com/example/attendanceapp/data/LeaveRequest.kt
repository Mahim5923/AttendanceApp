package com.example.attendanceapp.data

enum class LeaveStatus {
    PENDING, APPROVED, REJECTED
}

data class LeaveRequest(
    val id: String,
    val employeeId: String,
    val dateTimestamp: Long, // Represents the specific day they want off
    val reason: String,
    val status: LeaveStatus = LeaveStatus.PENDING,
    val requestedAtTimestamp: Long
) {
    fun toJson(): org.json.JSONObject {
        val json = org.json.JSONObject()
        json.put("id", id)
        json.put("employeeId", employeeId)
        json.put("dateTimestamp", dateTimestamp)
        json.put("reason", reason)
        json.put("status", status.name)
        json.put("requestedAtTimestamp", requestedAtTimestamp)
        return json
    }

    companion object {
        fun fromJson(json: org.json.JSONObject): LeaveRequest {
            return LeaveRequest(
                id = json.getString("id"),
                employeeId = json.getString("employeeId"),
                dateTimestamp = json.getLong("dateTimestamp"),
                reason = json.getString("reason"),
                status = LeaveStatus.valueOf(json.optString("status", LeaveStatus.PENDING.name)),
                requestedAtTimestamp = json.getLong("requestedAtTimestamp")
            )
        }
    }
}
