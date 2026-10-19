package com.example.attendanceapp

import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue

object LanguageManager {
    var isHindi by mutableStateOf(false)

    fun t(english: String): String {
        if (!isHindi) return english
        return dictionary[english] ?: english
    }

    private val dictionary = mapOf(
        "Login" to "लॉग इन करें",
        "Email" to "ईमेल",
        "Password" to "पासवर्ड",
        "Admin Dashboard" to "एडमिन डैशबोर्ड",
        "Logout" to "लॉग आउट",
        "Manage Leave Requests" to "छुट्टी के अनुरोध",
        "Export Monthly Report (.csv)" to "मासिक रिपोर्ट निर्यात करें (.csv)",
        "Employees" to "कर्मचारी",
        "Edit Profile" to "प्रोफ़ाइल संपादित करें",
        "In" to "अंदर",
        "Out" to "बाहर",
        "View My Attendance" to "मेरी उपस्थिति",
        "Request Leave" to "छुट्टी का अनुरोध",
        "Salary Calculator" to "वेतन कैलकुलेटर",
        "Take Photo & Mark Location" to "फोटो लें और स्थान चिह्नित करें",
        "Submit Request" to "अनुरोध जमा करें",
        "Save Profile" to "प्रोफ़ाइल सहेजें",
        "My Profile" to "मेरी प्रोफ़ाइल",
        "Take Profile Photo" to "प्रोफ़ाइल फ़ोटो लें",
        "Display Name" to "दिखने वाला नाम",
        "Reason for leave" to "छुट्टी का कारण",
        "My Leave Requests" to "मेरे छुट्टी के अनुरोध",
        "My Attendance" to "मेरी उपस्थिति",
        "Settings" to "सेटिंग्स",
        "Base Salary (₹)" to "मूल वेतन (₹)",
        "Check-In Hour (24h)" to "चेक-इन घंटा (24h)",
        "Min" to "मिनट",
        "Check-Out Hour (24h)" to "चेक-आउट घंटा (24h)",
        "Save Settings" to "सेटिंग्स सहेजें",
        "Salary Calculator Dashboard" to "वेतन कैलकुलेटर",
        "Approve" to "मंजूर",
        "Reject" to "अस्वीकार",
        "No attendance records found." to "कोई उपस्थिति रिकॉर्ड नहीं मिला।",
        "No leave requests found." to "कोई छुट्टी अनुरोध नहीं मिला।",
        "No employees found." to "कोई कर्मचारी नहीं मिला।",
        "Take Photo & Mark Location" to "फोटो लें और स्थान चिह्नित करें"
    )
}
