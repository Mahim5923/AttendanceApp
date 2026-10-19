// AttendPro - Modern iOS & Mobile Web App Controller
import {
  auth,
  getDb,
  fallbackToDefaultDb,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where
} from "./firebase-config.js";

// --- State ---
let currentUser = null;
let isAdmin = false;
let currentLanguage = "EN"; // "EN" or "HI"

let attendances = [];
let employeeSettingsList = [];
let leaveRequests = [];
let chatMessages = [];
let activeChatPartner = null;

let currentGpsLocation = null;
let clockActionType = "IN"; // "IN" or "OUT"
let capturedPhotoBase64 = null;
let mediaStream = null;

// Realtime listeners
let unsubAttendances = null;
let unsubSettings = null;
let unsubLeaves = null;
let unsubMessages = null;

// Language Dictionary (matching Android LanguageManager.kt)
const dictionary = {
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
  "Reject": "अस्वीकार"
};

function t(str) {
  if (currentLanguage === "HI") {
    return dictionary[str] || str;
  }
  return str;
}

// --- DOM References ---
const mainHeader = document.getElementById("main-header");
const viewLogin = document.getElementById("view-login");
const viewDashboard = document.getElementById("view-dashboard");
const viewHistory = document.getElementById("view-history");
const viewSalary = document.getElementById("view-salary");
const viewLeave = document.getElementById("view-leave");
const viewChat = document.getElementById("view-chat");
const viewProfile = document.getElementById("view-profile");
const viewAdmin = document.getElementById("view-admin");

// Navigation View Switcher
function showView(viewElement) {
  [viewLogin, viewDashboard, viewHistory, viewSalary, viewLeave, viewChat, viewProfile, viewAdmin].forEach(v => {
    if (v) v.classList.remove("active");
  });
  if (viewElement) {
    viewElement.classList.add("active");
  }
}

// --- Live Clock ---
function startClock() {
  const timeEl = document.getElementById("dash-live-time");
  const dateEl = document.getElementById("dash-live-date");

  setInterval(() => {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  }, 1000);
}

// --- Geolocation & Haversine Distance ---
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function initGeolocation() {
  const geofenceText = document.getElementById("geofence-status-text");
  const radarDot = document.getElementById("radar-indicator");

  if (!navigator.geolocation) {
    if (geofenceText) geofenceText.textContent = "Geolocation not supported";
    return;
  }

  navigator.geolocation.watchPosition(
    (pos) => {
      currentGpsLocation = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };

      const mySettings = getMySettings();
      if (mySettings && (mySettings.targetLatitude !== 0 || mySettings.targetLongitude !== 0)) {
        const dist = calculateDistanceMeters(
          currentGpsLocation.lat,
          currentGpsLocation.lon,
          mySettings.targetLatitude,
          mySettings.targetLongitude
        );
        const inGeofence = dist <= (mySettings.targetRadiusMeters || 100);

        if (inGeofence) {
          radarDot.className = "radar-dot pulsing";
          geofenceText.textContent = `Within Geofence (${Math.round(dist)}m to office)`;
        } else {
          radarDot.className = "radar-dot out-of-range";
          geofenceText.textContent = `Outside Geofence (${Math.round(dist)}m away, limit ${mySettings.targetRadiusMeters || 100}m)`;
        }
      } else {
        radarDot.className = "radar-dot pulsing";
        geofenceText.textContent = `GPS Active (Accuracy ±${Math.round(pos.coords.accuracy)}m)`;
      }
    },
    (err) => {
      console.warn("Location error:", err);
      if (geofenceText) geofenceText.textContent = "Location access needed for Geofence";
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
}

function getMySettings() {
  const email = currentUser?.email || "";
  return employeeSettingsList.find(s => s.employeeId?.toLowerCase() === email.toLowerCase()) || {
    employeeId: email,
    targetLatitude: 0,
    targetLongitude: 0,
    targetRadiusMeters: 100,
    baseSalary: 0,
    weekOffs: [0, 6] // Sun, Sat (0-indexed in JS)
  };
}

// --- Firebase Authentication ---
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-password").value;
  const btn = document.getElementById("btn-login-submit");
  const errEl = document.getElementById("login-error");

  btn.disabled = true;
  btn.textContent = "Authenticating...";
  errEl.style.display = "none";

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (error) {
    errEl.textContent = error.message || "Failed to log in";
    errEl.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Login";
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    const userEmail = (user.email || "").toLowerCase();
    isAdmin = userEmail === "admin" || userEmail === "mahimsinhsingoria@gmail.com";
    mainHeader.style.display = "flex";
    document.getElementById("btn-header-profile").title = user.email;

    setupFirestoreListeners(user.email);

    if (isAdmin) {
      showView(viewAdmin);
    } else {
      showView(viewDashboard);
    }
  } else {
    detachListeners();
    mainHeader.style.display = "none";
    showView(viewLogin);
    const btn = document.getElementById("btn-login-submit");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Login";
    }
  }
});

// Logout
document.getElementById("btn-header-logout").addEventListener("click", () => {
  if (confirm("Are you sure you want to log out?")) {
    signOut(auth);
  }
});

// --- Firestore Realtime Listeners with Fallback ---
function detachListeners() {
  if (unsubAttendances) unsubAttendances();
  if (unsubSettings) unsubSettings();
  if (unsubLeaves) unsubLeaves();
  if (unsubMessages) unsubMessages();
}

function setupFirestoreListeners(email) {
  detachListeners();
  let db = getDb();

  const handleListenerError = (err, context) => {
    console.error(`Firestore error in ${context}:`, err);
    if (err.code === "not-found" || err.message?.includes("database")) {
      console.warn("Database not found, switching to default database...");
      db = fallbackToDefaultDb();
      setupFirestoreListeners(email);
    }
  };

  try {
    // 1. Settings listener
    const settingsCol = collection(db, "settings");
    unsubSettings = onSnapshot(settingsCol, (snap) => {
      employeeSettingsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAdminDashboard();
      updateDashboardStatus();
    }, (err) => handleListenerError(err, "settings"));

    // 2. Attendances listener
    const attendancesCol = collection(db, "attendances");
    const attQuery = isAdmin ? attendancesCol : query(attendancesCol, where("employeeId", "==", email));
    unsubAttendances = onSnapshot(attQuery, (snap) => {
      attendances = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      updateDashboardStatus();
      renderAttendanceHistory();
      renderSalaryReport();
      renderAdminDashboard();
    }, (err) => handleListenerError(err, "attendances"));

    // 3. Leave Requests listener
    const leavesCol = collection(db, "leaveRequests");
    const leaveQuery = isAdmin ? leavesCol : query(leavesCol, where("employeeId", "==", email));
    unsubLeaves = onSnapshot(leaveQuery, (snap) => {
      leaveRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.requestedAtTimestamp || 0) - (a.requestedAtTimestamp || 0));
      renderLeaveRequests();
      renderAdminDashboard();
    }, (err) => handleListenerError(err, "leaveRequests"));

    // 4. Messages listener
    const messagesCol = collection(db, "messages");
    unsubMessages = onSnapshot(messagesCol, (snap) => {
      chatMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      renderChatMessages();
    }, (err) => handleListenerError(err, "messages"));

  } catch (e) {
    console.error("Setup listeners failed:", e);
    fallbackToDefaultDb();
  }
}

// --- Dashboard Status Badge ---
function updateDashboardStatus() {
  const badge = document.getElementById("dash-status-badge");
  const greeting = document.getElementById("dash-greeting");
  if (!badge) return;

  const myEmail = currentUser?.email || "";
  greeting.textContent = myEmail.split("@")[0] || "Welcome back";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayRecords = attendances.filter(a => 
    a.employeeId?.toLowerCase() === myEmail.toLowerCase() && 
    (a.timestamp || 0) >= todayStart.getTime()
  );

  if (todayRecords.length === 0) {
    badge.className = "badge badge-out";
    badge.textContent = "NOT MARKED TODAY";
  } else {
    const lastRecord = todayRecords[0]; // sorted descending
    if (lastRecord.type === "IN") {
      const timeStr = new Date(lastRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      badge.className = "badge badge-in";
      badge.textContent = `CHECKED IN AT ${timeStr}`;
    } else {
      const timeStr = new Date(lastRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      badge.className = "badge badge-out";
      badge.textContent = `CHECKED OUT AT ${timeStr}`;
    }
  }
}

// --- Camera & Attendance Clocking Modal ---
const modalCamera = document.getElementById("modal-camera");
const cameraVideo = document.getElementById("camera-video");
const cameraCanvas = document.getElementById("camera-canvas");
const cameraPhotoPreview = document.getElementById("camera-photo-preview");
const btnCapturePhoto = document.getElementById("btn-capture-photo");
const btnRetakePhoto = document.getElementById("btn-retake-photo");
const btnSubmitAttendance = document.getElementById("btn-submit-attendance");
const cameraFallback = document.getElementById("camera-fallback");
const cameraFileInput = document.getElementById("camera-file-input");

async function openAttendanceModal(type) {
  clockActionType = type;
  capturedPhotoBase64 = null;
  document.getElementById("camera-modal-title").textContent = `Mark ${type} Attendance`;
  
  cameraVideo.style.display = "block";
  cameraPhotoPreview.style.display = "none";
  btnCapturePhoto.style.display = "inline-flex";
  btnRetakePhoto.style.display = "none";
  btnSubmitAttendance.style.display = "none";

  const modalGeofenceText = document.getElementById("modal-geofence-text");
  const modalRadarDot = document.getElementById("modal-radar-dot");

  // Geofence check
  const mySettings = getMySettings();
  if (currentGpsLocation && (mySettings.targetLatitude !== 0 || mySettings.targetLongitude !== 0)) {
    const dist = calculateDistanceMeters(
      currentGpsLocation.lat,
      currentGpsLocation.lon,
      mySettings.targetLatitude,
      mySettings.targetLongitude
    );
    if (dist <= (mySettings.targetRadiusMeters || 100)) {
      modalRadarDot.className = "radar-dot pulsing";
      modalGeofenceText.textContent = `Verified: Inside office perimeter (${Math.round(dist)}m)`;
    } else {
      modalRadarDot.className = "radar-dot out-of-range";
      modalGeofenceText.textContent = `Warning: ${Math.round(dist)}m from office (limit: ${mySettings.targetRadiusMeters}m)`;
    }
  } else {
    modalGeofenceText.textContent = "GPS Location captured";
  }

  modalCamera.classList.add("open");

  // Start Camera
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      cameraVideo.srcObject = mediaStream;
      cameraFallback.style.display = "none";
    } else {
      cameraFallback.style.display = "block";
    }
  } catch (err) {
    console.warn("Camera access error:", err);
    cameraFallback.style.display = "block";
    cameraVideo.style.display = "none";
  }
}

function closeCameraModal() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  modalCamera.classList.remove("open");
}

document.getElementById("btn-clock-in").addEventListener("click", () => openAttendanceModal("IN"));
document.getElementById("btn-clock-out").addEventListener("click", () => openAttendanceModal("OUT"));
document.getElementById("btn-close-camera").addEventListener("click", closeCameraModal);

btnCapturePhoto.addEventListener("click", () => {
  if (cameraVideo.srcObject) {
    const w = cameraVideo.videoWidth || 400;
    const h = cameraVideo.videoHeight || 300;
    cameraCanvas.width = Math.min(w, 400);
    cameraCanvas.height = Math.round(h * (cameraCanvas.width / w));
    const ctx = cameraCanvas.getContext("2d");
    ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
    capturedPhotoBase64 = cameraCanvas.toDataURL("image/jpeg", 0.7);

    cameraPhotoPreview.src = capturedPhotoBase64;
    cameraPhotoPreview.style.display = "block";
    cameraVideo.style.display = "none";

    btnCapturePhoto.style.display = "none";
    btnRetakePhoto.style.display = "inline-flex";
    btnSubmitAttendance.style.display = "inline-flex";
  }
});

btnRetakePhoto.addEventListener("click", () => {
  capturedPhotoBase64 = null;
  cameraPhotoPreview.style.display = "none";
  cameraVideo.style.display = "block";
  btnCapturePhoto.style.display = "inline-flex";
  btnRetakePhoto.style.display = "none";
  btnSubmitAttendance.style.display = "none";
});

cameraFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    capturedPhotoBase64 = ev.target.result;
    cameraPhotoPreview.src = capturedPhotoBase64;
    cameraPhotoPreview.style.display = "block";
    cameraFallback.style.display = "none";
    btnCapturePhoto.style.display = "none";
    btnRetakePhoto.style.display = "inline-flex";
    btnSubmitAttendance.style.display = "inline-flex";
  };
  reader.readAsDataURL(file);
});

// Submit Attendance to Firestore
btnSubmitAttendance.addEventListener("click", async () => {
  if (!currentUser) return;
  const mySettings = getMySettings();

  // Geofence enforcement
  if (currentGpsLocation && mySettings.targetLatitude !== 0 && mySettings.targetLongitude !== 0) {
    const dist = calculateDistanceMeters(
      currentGpsLocation.lat,
      currentGpsLocation.lon,
      mySettings.targetLatitude,
      mySettings.targetLongitude
    );
    if (dist > (mySettings.targetRadiusMeters || 100)) {
      if (!confirm(`You are ${Math.round(dist)}m away from office (allowed: ${mySettings.targetRadiusMeters}m). Submit anyway?`)) {
        return;
      }
    }
  }

  btnSubmitAttendance.disabled = true;
  btnSubmitAttendance.textContent = "Saving...";

  const newId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `att_${Date.now()}`;
  const record = {
    id: newId,
    employeeId: currentUser.email,
    timestamp: Date.now(),
    latitude: currentGpsLocation ? currentGpsLocation.lat : 0.0,
    longitude: currentGpsLocation ? currentGpsLocation.lon : 0.0,
    photoUri: capturedPhotoBase64 || "",
    type: clockActionType
  };

  try {
    const db = getDb();
    await setDoc(doc(db, "attendances", newId), record);
    alert(`Success! Marked ${clockActionType}`);
    closeCameraModal();
  } catch (e) {
    console.error("Failed to save attendance:", e);
    // Retry with fallback default database
    try {
      const fallbackDb = fallbackToDefaultDb();
      await setDoc(doc(fallbackDb, "attendances", newId), record);
      alert(`Success! Marked ${clockActionType}`);
      closeCameraModal();
    } catch (err2) {
      alert(`Error saving: ${err2.message}`);
    }
  } finally {
    btnSubmitAttendance.disabled = false;
    btnSubmitAttendance.textContent = "Confirm & Submit";
  }
});

// --- Attendance History Rendering ---
function renderAttendanceHistory() {
  const container = document.getElementById("history-list-container");
  if (!container) return;

  const myRecords = isAdmin ? attendances : attendances.filter(a => a.employeeId?.toLowerCase() === currentUser?.email?.toLowerCase());

  if (myRecords.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 0;">${t("No attendance records found.")}</div>`;
    return;
  }

  container.innerHTML = myRecords.map(item => {
    const dt = new Date(item.timestamp);
    const dateStr = dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isClockIn = item.type === "IN";
    const badgeClass = isClockIn ? "badge-in" : "badge-out";
    const thumbSrc = item.photoUri && item.photoUri.length > 20 ? item.photoUri : "icons/logo.png";

    return `
      <div class="history-item">
        <img src="${thumbSrc}" class="history-thumb" alt="Selfie">
        <div class="history-info">
          <div class="history-title">
            <span class="badge ${badgeClass}" style="margin-right: 6px;">${item.type}</span>
            ${dateStr} - ${timeStr}
          </div>
          <div class="history-subtitle">
            ${isAdmin ? `<span>${item.employeeId} • </span>` : ''}
            <span>GPS: ${Number(item.latitude || 0).toFixed(4)}, ${Number(item.longitude || 0).toFixed(4)}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// --- Salary & Monthly Report Calculation ---
// Matches calculateSalaryForEmployee from MainScreenViewModel.kt
function calculateSalary(employeeId, year, month) {
  const settings = employeeSettingsList.find(s => s.employeeId?.toLowerCase() === employeeId.toLowerCase()) || {
    baseSalary: 0,
    weekOffs: [1, 7] // Android 1=Sun, 7=Sat
  };

  const baseSalary = Number(settings.baseSalary) || 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Convert weekOffs (Android 1=Sun..7=Sat to JS 0=Sun..6=Sat)
  const jsWeekOffs = (settings.weekOffs || [1, 7]).map(w => (w === 1 ? 0 : w - 1));

  let totalWorkingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = new Date(year, month, d).getDay();
    if (!jsWeekOffs.includes(dayOfWeek)) {
      totalWorkingDays++;
    }
  }

  // Count distinct present days with type == "IN" in this month
  const presentDaysSet = new Set();
  attendances.forEach(a => {
    if (a.employeeId?.toLowerCase() === employeeId.toLowerCase() && a.type === "IN") {
      const d = new Date(a.timestamp);
      if (d.getFullYear() === year && d.getMonth() === month) {
        presentDaysSet.add(d.getDate());
      }
    }
  });
  const presentDays = presentDaysSet.size;

  // Approved leave days in this month
  const approvedLeavesSet = new Set();
  leaveRequests.forEach(l => {
    if (l.employeeId?.toLowerCase() === employeeId.toLowerCase() && l.status === "APPROVED") {
      const d = new Date(l.dateTimestamp);
      if (d.getFullYear() === year && d.getMonth() === month) {
        approvedLeavesSet.add(d.getDate());
      }
    }
  });
  const approvedLeaveDays = approvedLeavesSet.size;

  const absentDays = Math.max(0, totalWorkingDays - presentDays - approvedLeaveDays);
  const perDaySalary = totalWorkingDays > 0 ? baseSalary / totalWorkingDays : 0;
  const deduction = perDaySalary * (absentDays + approvedLeaveDays);
  const netSalary = Math.max(0, baseSalary - deduction);

  return {
    baseSalary,
    totalWorkingDays,
    presentDays,
    approvedLeaveDays,
    absentDays,
    perDaySalary,
    deduction,
    netSalary
  };
}

function renderSalaryReport() {
  const monthPicker = document.getElementById("salary-month-picker");
  if (!monthPicker.value) {
    const now = new Date();
    monthPicker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const [yearStr, monthStr] = monthPicker.value.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1;

  const email = currentUser?.email || "";
  const stats = calculateSalary(email, year, month);

  document.getElementById("sal-base-val").textContent = `₹${Math.round(stats.baseSalary).toLocaleString()}`;
  document.getElementById("sal-working-days").textContent = stats.totalWorkingDays;
  document.getElementById("sal-present-days").textContent = stats.presentDays;
  document.getElementById("sal-absent-days").textContent = `${stats.absentDays} (Leaves: ${stats.approvedLeaveDays})`;
  document.getElementById("sal-per-day").textContent = `₹${Math.round(stats.perDaySalary).toLocaleString()}`;
  document.getElementById("sal-deductions").textContent = `₹${Math.round(stats.deduction).toLocaleString()}`;
  document.getElementById("sal-net-val").textContent = `₹${Math.round(stats.netSalary).toLocaleString()}`;
}

document.getElementById("salary-month-picker").addEventListener("change", renderSalaryReport);

// Export CSV
document.getElementById("btn-export-csv").addEventListener("click", () => {
  const monthVal = document.getElementById("salary-month-picker").value;
  const [yearStr, monthStr] = monthVal.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1;

  const targetEmployees = isAdmin ? getAllEmployeesList() : [currentUser.email];
  let csv = "Employee,Base Salary,Working Days,Present,Approved Leaves,Absent,Per Day Rate,Deduction,Net Salary\n";

  targetEmployees.forEach(emp => {
    const s = calculateSalary(emp, year, month);
    csv += `"${emp}",${s.baseSalary},${s.totalWorkingDays},${s.presentDays},${s.approvedLeaveDays},${s.absentDays},${Math.round(s.perDaySalary)},${Math.round(s.deduction)},${Math.round(s.netSalary)}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `AttendPro_Salary_${monthVal}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// --- Leave Requests ---
document.getElementById("leave-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dateInput = document.getElementById("leave-date").value;
  const reason = document.getElementById("leave-reason").value.trim();
  const btn = document.getElementById("btn-submit-leave");

  if (!dateInput || !reason || !currentUser) return;
  btn.disabled = true;

  const dateTimestamp = new Date(dateInput).getTime();
  const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `leave_${Date.now()}`;

  const req = {
    id,
    employeeId: currentUser.email,
    dateTimestamp,
    reason,
    status: "PENDING",
    requestedAtTimestamp: Date.now()
  };

  try {
    const db = getDb();
    await setDoc(doc(db, "leaveRequests", id), req);
    alert("Leave request submitted!");
    document.getElementById("leave-reason").value = "";
  } catch (err) {
    console.error("Leave request error:", err);
    try {
      const fallbackDb = fallbackToDefaultDb();
      await setDoc(doc(fallbackDb, "leaveRequests", id), req);
      alert("Leave request submitted!");
      document.getElementById("leave-reason").value = "";
    } catch (err2) {
      alert("Error: " + err2.message);
    }
  } finally {
    btn.disabled = false;
  }
});

function renderLeaveRequests() {
  const container = document.getElementById("leave-history-container");
  if (!container) return;

  const myLeaves = leaveRequests.filter(l => l.employeeId?.toLowerCase() === currentUser?.email?.toLowerCase());
  if (myLeaves.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.88rem;">${t("No leave requests found.")}</div>`;
    return;
  }

  container.innerHTML = myLeaves.map(l => {
    const dt = new Date(l.dateTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    let badge = `<span class="badge badge-neutral">PENDING</span>`;
    if (l.status === "APPROVED") badge = `<span class="badge badge-in">APPROVED</span>`;
    if (l.status === "REJECTED") badge = `<span class="badge badge-out">REJECTED</span>`;

    return `
      <div class="history-item">
        <div class="history-info">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: 600;">Date: ${dt}</span>
            ${badge}
          </div>
          <div style="font-size: 0.84rem; color: var(--text-muted);">${l.reason}</div>
        </div>
      </div>
    `;
  }).join("");
}

// --- Realtime Chat ---
function renderChatMessages() {
  const container = document.getElementById("chat-messages-container");
  if (!container) return;

  const myEmail = (currentUser?.email || "").toLowerCase();
  const partner = activeChatPartner || (isAdmin ? null : "admin");

  const filtered = chatMessages.filter(m => {
    const sender = (m.senderId || "").toLowerCase();
    const receiver = (m.receiverId || "").toLowerCase();
    if (isAdmin) {
      if (!partner) return true;
      return (sender === partner && receiver === myEmail) || (sender === myEmail && receiver === partner);
    } else {
      return (sender === myEmail && (receiver === "admin" || receiver.includes("@"))) ||
             ((sender === "admin" || sender.includes("@")) && receiver === myEmail);
    }
  });

  container.innerHTML = filtered.map(m => {
    const isMine = (m.senderId || "").toLowerCase() === myEmail;
    const timeStr = new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">
        <div>${m.content || ''}</div>
        <span class="chat-time">${timeStr}</span>
      </div>
    `;
  }).join("");

  container.scrollTop = container.scrollHeight;
}

document.getElementById("chat-send-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("chat-input-text");
  const content = input.value.trim();
  if (!content || !currentUser) return;

  const myEmail = currentUser.email;
  const receiverId = activeChatPartner || (isAdmin ? "all" : "mahimsinhsingoria@gmail.com");
  const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `msg_${Date.now()}`;

  const msg = {
    id,
    senderId: myEmail,
    receiverId,
    content,
    timestamp: Date.now(),
    isRead: false
  };

  input.value = "";
  try {
    const db = getDb();
    await setDoc(doc(db, "messages", id), msg);
  } catch (err) {
    const fallbackDb = fallbackToDefaultDb();
    await setDoc(doc(fallbackDb, "messages", id), msg);
  }
});

// --- Profile Screen ---
function openProfile() {
  if (!currentUser) return;
  document.getElementById("profile-email").value = currentUser.email;
  const mySettings = getMySettings();
  document.getElementById("profile-name").value = mySettings.displayName || currentUser.email.split("@")[0];
  if (mySettings.profilePhotoUri) {
    document.getElementById("profile-avatar-preview").src = mySettings.profilePhotoUri;
  }
  showView(viewProfile);
}

document.getElementById("profile-photo-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById("profile-avatar-preview").src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const displayName = document.getElementById("profile-name").value.trim();
  const photo = document.getElementById("profile-avatar-preview").src;
  const email = currentUser.email;

  const data = {
    employeeId: email,
    displayName,
    profilePhotoUri: photo
  };

  try {
    const db = getDb();
    await setDoc(doc(db, "settings", email), data, { merge: true });
    alert("Profile saved successfully!");
  } catch (err) {
    const fallbackDb = fallbackToDefaultDb();
    await setDoc(doc(fallbackDb, "settings", email), data, { merge: true });
    alert("Profile saved successfully!");
  }
});

// --- Admin Dashboard Operations ---
function getAllEmployeesList() {
  const fromSettings = employeeSettingsList.map(s => s.employeeId).filter(Boolean);
  const fromAttendances = attendances.map(a => a.employeeId).filter(e => e && e !== "admin");
  return Array.from(new Set([...fromSettings, ...fromAttendances]));
}

function renderAdminDashboard() {
  if (!isAdmin) return;
  const allStaff = getAllEmployeesList();
  document.getElementById("admin-total-staff").textContent = allStaff.length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const presentTodaySet = new Set(
    attendances.filter(a => a.type === "IN" && (a.timestamp || 0) >= todayStart.getTime())
      .map(a => a.employeeId?.toLowerCase())
  );
  document.getElementById("admin-present-today").textContent = presentTodaySet.size;

  // Pending leaves
  const pendingLeaves = leaveRequests.filter(l => l.status === "PENDING");
  document.getElementById("admin-pending-count").textContent = pendingLeaves.length;

  // Staff list
  const staffContainer = document.getElementById("admin-employee-list");
  if (staffContainer) {
    if (allStaff.length === 0) {
      staffContainer.innerHTML = `<div style="color: var(--text-muted); padding: 20px 0; text-align: center;">${t("No employees found.")}</div>`;
    } else {
      staffContainer.innerHTML = allStaff.map(emp => {
        const isPresent = presentTodaySet.has(emp.toLowerCase());
        const setting = employeeSettingsList.find(s => s.employeeId?.toLowerCase() === emp.toLowerCase());
        const name = setting?.displayName || emp;
        const salary = setting?.baseSalary ? `₹${setting.baseSalary}` : "No salary set";

        return `
          <div class="employee-card" data-emp="${emp}">
            <div>
              <div style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
                ${name}
                <span class="badge ${isPresent ? 'badge-in' : 'badge-out'}">${isPresent ? 'PRESENT' : 'ABSENT'}</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
                ${emp} • ${salary}
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-admin-chat" data-emp="${emp}" style="padding: 6px 12px; font-size: 0.8rem;">Chat</button>
              <button class="btn btn-secondary btn-admin-edit" data-emp="${emp}" style="padding: 6px 12px; font-size: 0.8rem;">Settings</button>
            </div>
          </div>
        `;
      }).join("");

      // Bind buttons
      staffContainer.querySelectorAll(".btn-admin-edit").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          openAdminSettings(btn.getAttribute("data-emp"));
        });
      });
      staffContainer.querySelectorAll(".btn-admin-chat").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          activeChatPartner = btn.getAttribute("data-emp");
          document.getElementById("chat-header-title").textContent = `Chat with ${activeChatPartner}`;
          showView(viewChat);
          renderChatMessages();
        });
      });
    }
  }

  // Pending leaves list
  const leavesContainer = document.getElementById("admin-leaves-list");
  if (leavesContainer) {
    if (pendingLeaves.length === 0) {
      leavesContainer.innerHTML = `<div style="color: var(--text-muted); padding: 20px 0; text-align: center;">No pending requests.</div>`;
    } else {
      leavesContainer.innerHTML = pendingLeaves.map(l => {
        const dt = new Date(l.dateTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        return `
          <div class="employee-card">
            <div>
              <div style="font-weight: 600;">${l.employeeId}</div>
              <div style="font-size: 0.84rem; color: var(--text-muted); margin: 3px 0;">Date: ${dt} • "${l.reason}"</div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-success btn-approve-leave" data-id="${l.id}" style="padding: 6px 10px; font-size: 0.78rem;">Approve</button>
              <button class="btn btn-clock-out btn-reject-leave" data-id="${l.id}" style="padding: 6px 10px; font-size: 0.78rem;">Reject</button>
            </div>
          </div>
        `;
      }).join("");

      leavesContainer.querySelectorAll(".btn-approve-leave").forEach(btn => {
        btn.addEventListener("click", () => updateLeaveStatus(btn.getAttribute("data-id"), "APPROVED"));
      });
      leavesContainer.querySelectorAll(".btn-reject-leave").forEach(btn => {
        btn.addEventListener("click", () => updateLeaveStatus(btn.getAttribute("data-id"), "REJECTED"));
      });
    }
  }
}

async function updateLeaveStatus(id, status) {
  try {
    const db = getDb();
    await updateDoc(doc(db, "leaveRequests", id), { status });
  } catch (err) {
    const fallbackDb = fallbackToDefaultDb();
    await updateDoc(doc(fallbackDb, "leaveRequests", id), { status });
  }
}

// Admin Tab buttons
document.getElementById("btn-admin-tab-staff").addEventListener("click", () => {
  document.getElementById("btn-admin-tab-staff").classList.add("active");
  document.getElementById("btn-admin-tab-leaves").classList.remove("active");
  document.getElementById("admin-tab-staff-content").style.display = "block";
  document.getElementById("admin-tab-leaves-content").style.display = "none";
});

document.getElementById("btn-admin-tab-leaves").addEventListener("click", () => {
  document.getElementById("btn-admin-tab-leaves").classList.add("active");
  document.getElementById("btn-admin-tab-staff").classList.remove("active");
  document.getElementById("admin-tab-staff-content").style.display = "none";
  document.getElementById("admin-tab-leaves-content").style.display = "block";
});

// Admin Employee Settings Modal
const modalAdminSettings = document.getElementById("modal-admin-settings");
function openAdminSettings(employeeId) {
  const setting = employeeSettingsList.find(s => s.employeeId?.toLowerCase() === employeeId.toLowerCase()) || {
    employeeId,
    displayName: employeeId.split("@")[0],
    baseSalary: 30000,
    checkInTimeHours: 9,
    checkInTimeMinutes: 0,
    checkOutTimeHours: 17,
    checkOutTimeMinutes: 0,
    targetLatitude: currentGpsLocation ? currentGpsLocation.lat : 0,
    targetLongitude: currentGpsLocation ? currentGpsLocation.lon : 0,
    targetRadiusMeters: 100
  };

  document.getElementById("admin-set-id").value = employeeId;
  document.getElementById("admin-set-name").value = setting.displayName || employeeId;
  document.getElementById("admin-set-salary").value = setting.baseSalary || 0;
  document.getElementById("admin-set-in-hour").value = setting.checkInTimeHours ?? 9;
  document.getElementById("admin-set-in-min").value = setting.checkInTimeMinutes ?? 0;
  document.getElementById("admin-set-out-hour").value = setting.checkOutTimeHours ?? 17;
  document.getElementById("admin-set-out-min").value = setting.checkOutTimeMinutes ?? 0;
  document.getElementById("admin-set-lat").value = setting.targetLatitude || 0;
  document.getElementById("admin-set-lon").value = setting.targetLongitude || 0;
  document.getElementById("admin-set-radius").value = setting.targetRadiusMeters || 100;

  modalAdminSettings.classList.add("open");
}

document.getElementById("btn-close-admin-settings").addEventListener("click", () => {
  modalAdminSettings.classList.remove("open");
});

document.getElementById("btn-admin-fill-gps").addEventListener("click", () => {
  if (currentGpsLocation) {
    document.getElementById("admin-set-lat").value = currentGpsLocation.lat;
    document.getElementById("admin-set-lon").value = currentGpsLocation.lon;
  } else {
    alert("Location not yet acquired. Please allow GPS access.");
  }
});

document.getElementById("admin-settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const empId = document.getElementById("admin-set-id").value;
  const payload = {
    employeeId: empId,
    displayName: document.getElementById("admin-set-name").value.trim(),
    baseSalary: parseFloat(document.getElementById("admin-set-salary").value) || 0,
    checkInTimeHours: parseInt(document.getElementById("admin-set-in-hour").value) || 9,
    checkInTimeMinutes: parseInt(document.getElementById("admin-set-in-min").value) || 0,
    checkOutTimeHours: parseInt(document.getElementById("admin-set-out-hour").value) || 17,
    checkOutTimeMinutes: parseInt(document.getElementById("admin-set-out-min").value) || 0,
    targetLatitude: parseFloat(document.getElementById("admin-set-lat").value) || 0,
    targetLongitude: parseFloat(document.getElementById("admin-set-lon").value) || 0,
    targetRadiusMeters: parseFloat(document.getElementById("admin-set-radius").value) || 100
  };

  try {
    const db = getDb();
    await setDoc(doc(db, "settings", empId), payload, { merge: true });
    alert("Settings updated!");
    modalAdminSettings.classList.remove("open");
  } catch (err) {
    const fallbackDb = fallbackToDefaultDb();
    await setDoc(doc(fallbackDb, "settings", empId), payload, { merge: true });
    alert("Settings updated!");
    modalAdminSettings.classList.remove("open");
  }
});

// --- Navigation Links ---
document.getElementById("brand-home-link").addEventListener("click", (e) => {
  e.preventDefault();
  if (currentUser) {
    showView(isAdmin ? viewAdmin : viewDashboard);
  }
});

document.getElementById("btn-menu-attendance").addEventListener("click", () => {
  showView(viewHistory);
  renderAttendanceHistory();
});
document.getElementById("btn-back-history").addEventListener("click", () => showView(isAdmin ? viewAdmin : viewDashboard));

document.getElementById("btn-menu-salary").addEventListener("click", () => {
  showView(viewSalary);
  renderSalaryReport();
});
document.getElementById("btn-back-salary").addEventListener("click", () => showView(isAdmin ? viewAdmin : viewDashboard));

document.getElementById("btn-menu-leave").addEventListener("click", () => {
  showView(viewLeave);
  renderLeaveRequests();
});
document.getElementById("btn-back-leave").addEventListener("click", () => showView(isAdmin ? viewAdmin : viewDashboard));

document.getElementById("btn-menu-chat").addEventListener("click", () => {
  activeChatPartner = null;
  document.getElementById("chat-header-title").textContent = "Chat with Admin";
  showView(viewChat);
  renderChatMessages();
});
document.getElementById("btn-header-chat").addEventListener("click", () => {
  activeChatPartner = null;
  document.getElementById("chat-header-title").textContent = isAdmin ? "Messages" : "Chat with Admin";
  showView(viewChat);
  renderChatMessages();
});
document.getElementById("btn-back-chat").addEventListener("click", () => showView(isAdmin ? viewAdmin : viewDashboard));

document.getElementById("btn-header-profile").addEventListener("click", openProfile);
document.getElementById("btn-back-profile").addEventListener("click", () => showView(isAdmin ? viewAdmin : viewDashboard));

// Language toggle (EN / HI)
document.getElementById("btn-lang-toggle").addEventListener("click", () => {
  currentLanguage = currentLanguage === "EN" ? "HI" : "EN";
  document.getElementById("btn-lang-toggle").textContent = currentLanguage;

  // Translate key labels
  document.getElementById("lbl-email").textContent = t("Email");
  document.getElementById("lbl-password").textContent = t("Password");
  document.getElementById("txt-btn-login").textContent = t("Login");
  document.getElementById("txt-clock-in").textContent = `Mark ${t("In")}`;
  document.getElementById("txt-clock-out").textContent = `Mark ${t("Out")}`;
  document.getElementById("txt-menu-att").textContent = t("My Attendance");
  document.getElementById("txt-menu-sal").textContent = t("Salary Calculator");
  document.getElementById("txt-menu-leave").textContent = t("Request Leave");
  document.getElementById("txt-history-title").textContent = t("My Attendance");
  document.getElementById("txt-salary-title").textContent = t("Salary Calculator Dashboard");

  renderAttendanceHistory();
  renderLeaveRequests();
  renderAdminDashboard();
});

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration error:', err));
  });
}

// Start live systems
startClock();
initGeolocation();
