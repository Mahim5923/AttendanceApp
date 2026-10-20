// Language Dictionary (100% matches Android LanguageManager.kt)
export const dictionary = {
  "Login": "लॉग इन करें",
  "Email": "ईमेल",
  "Password": "पासवर्ड",
  "Admin Dashboard": "एडमिन डैशबोर्ड",
  "Logout": "लॉग आउट",
  "Manage Leave Requests": "छुट्टी के अनुरोध",
  "Export Monthly Report (.csv)": "मासिक रिपोर्ट निर्यात करें (.csv)",
  "Employees": "कर्मचारी",
  "Edit Profile": "प्रोफ़ाइल संपादित करें",
  "In": "अंदर",
  "Out": "बाहर",
  "View My Attendance": "मेरी उपस्थिति",
  "Request Leave": "छुट्टी का अनुरोध",
  "Salary Calculator": "वेतन कैलकुलेटर",
  "Take Photo & Mark Location": "फोटो लें और स्थान चिह्नित करें",
  "Submit Request": "अनुरोध जमा करें",
  "Save Profile": "प्रोफ़ाइल सहेजें",
  "My Profile": "मेरी प्रोफ़ाइल",
  "Take Profile Photo": "प्रोफ़ाइल फ़ोटो लें",
  "Display Name": "दिखने वाला नाम",
  "Reason for leave": "छुट्टी का कारण",
  "My Leave Requests": "मेरे छुट्टी के अनुरोध",
  "My Attendance": "मेरी उपस्थिति",
  "Settings": "सेटिंग्स",
  "Base Salary (₹)": "मूल वेतन (₹)",
  "Check-In Hour (24h)": "चेक-इन घंटा (24h)",
  "Min": "मिनट",
  "Check-Out Hour (24h)": "चेक-आउट घंटा (24h)",
  "Save Settings": "सेटिंग्स सहेजें",
  "Salary Calculator Dashboard": "वेतन कैलकुलेटर",
  "Approve": "मंजूर",
  "Reject": "अस्वीकार",
  "Leaves": "छुट्टियां",
  "No attendance records found.": "कोई उपस्थिति रिकॉर्ड नहीं मिला।",
  "No leave requests found.": "कोई छुट्टी अनुरोध नहीं मिला।",
  "No employees found.": "कोई कर्मचारी नहीं मिला।",
  "Smart Attendance & Workforce Management": "स्मार्ट उपस्थिति एवं कार्यबल प्रबंधन",
  "Chat with Admin": "एडमिन से चैट करें"
};

export function t(text, isHindi) {
  if (isHindi && dictionary[text]) {
    return dictionary[text];
  }
  return text;
}
