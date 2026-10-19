// AttendPro - Modern iOS & Mobile Web App Controller
// 100% Matches Android Material 3 UI & Exact Feature Working
import {
  auth,
  getDb,
  fallbackToDefaultDb,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where
} from "./firebase-config.js?v=2.1";

// --- State Variables ---
let currentUser = null;
let isAdmin = false;
let isHindi = false;
let isSignUpMode = false;

let attendances = [];
let employeeSettingsList = [];
let leaveRequests = [];
let chatMessages = [];
let activeChatPartner = null;

let currentGpsLocation = null;
let clockActionType = "IN";
let capturedPhotoBase64 = null;
let mediaStream = null;

// Calendar State
let calendarDate = new Date();
let selectedCalendarDate = new Date();

// Firestore real-time listener unsubs
let unsubAttendances = null;
let unsubSettings = null;
let unsubLeaves = null;
let unsubMessages = null;

// --- Language Dictionary (100% matches Android LanguageManager.kt) ---
const dictionary = {
  "Login": "लॉग इन करें",
  "Email": "ईमेल",
  "Password": "पासवर्ड",
  "In": "अंदर",
  "Out": "बाहर",
  "View My Attendance": "मेरी उपस्थिति",
  "Request Leave": "छुट्टी का अनुरोध",
  "Salary Calculator": "वेतन कैलकुलेटर",
  "Logout": "लॉग आउट",
  "Edit Profile": "प्रोफ़ाइल संपादित करें",
  "Smart Attendance & Workforce Management": "स्मार्ट उपस्थिति एवं कार्यबल प्रबंधन",
  "My Attendance": "मेरी उपस्थिति",
  "Reason for leave": "छुट्टी का कारण",
  "Submit Request": "अनुरोध जमा करें",
  "Salary Calculator Dashboard": "वेतन कैलकुलेटर",
  "Export Monthly Report (.csv)": "मासिक रिपोर्ट निर्यात करें (.csv)",
  "Chat with Admin": "एडमिन से चैट करें",
  "Save Profile": "प्रोफ़ाइल सहेजें",
  "Display Name": "दिखने वाला नाम",
  "Admin Dashboard": "एडमिन डैशबोर्ड",
  "Employees": "कर्मचारी",
  "Leaves": "छुट्टियां",
  "Approve": "मंजूर",
  "Reject": "अस्वीकार"
};

function t(text) {
  if (isHindi && dictionary[text]) {
    return dictionary[text];
  }
  return text;
}

// --- DOM References ---
const viewLogin = document.getElementById("view-login");
const viewMain = document.getElementById("view-main");
const viewHistory = document.getElementById("view-history");
const viewLeave = document.getElementById("view-leave");
const viewSalary = document.getElementById("view-salary");
const viewChat = document.getElementById("view-chat");
const viewProfile = document.getElementById("view-profile");
const viewAdmin = document.getElementById("view-admin");
const viewAdminLeaves = document.getElementById("view-admin-leaves");
const viewAdminReport = document.getElementById("view-admin-monthly-report");
const viewAdminDetail = document.getElementById("view-admin-employee-detail");

const allViews = [
  viewLogin,
  viewMain,
  viewHistory,
  viewLeave,
  viewSalary,
  viewChat,
  viewProfile,
  viewAdmin,
  viewAdminLeaves,
  viewAdminReport,
  viewAdminDetail
];

function showView(targetView) {
  allViews.forEach(v => {
    if (v) v.classList.remove("active");
  });
  if (targetView) {
    targetView.classList.add("active");
    window.scrollTo(0, 0);
  }
}

// --- Live Clock & Date (Matches Android MainScreen SimpleDateFormat) ---
function updateLiveClock() {
  const clockEl = document.getElementById("main-live-datetime");
  if (!clockEl) return;

  const now = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayNamesHi = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthNamesHi = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];

  const dayStr = isHindi ? dayNamesHi[now.getDay()] : dayNames[now.getDay()];
  const dateNum = String(now.getDate()).padStart(2, "0");
  const monthStr = isHindi ? monthNamesHi[now.getMonth()] : monthNames[now.getMonth()];
  const year = now.getFullYear();

  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? String(hours).padStart(2, "0") : "12";

  const timeStr = `${hours}:${minutes}:${seconds} ${ampm}`;
  clockEl.innerHTML = `${dayStr}, ${dateNum} ${monthStr} ${year}<br>${timeStr}`;
}
setInterval(updateLiveClock, 1000);
updateLiveClock();

// --- Geolocation Tracking ---
function initGeolocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(
    (pos) => {
      currentGpsLocation = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };
    },
    (err) => console.warn("GPS watch error:", err),
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
}
initGeolocation();

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getMySettings(empEmail = null) {
  const email = (empEmail || currentUser?.email || "").toLowerCase();
  return employeeSettingsList.find(s => (s.employeeId || "").toLowerCase() === email) || {
    employeeId: email,
    displayName: email.split("@")[0],
    targetLatitude: 0,
    targetLongitude: 0,
    targetRadiusMeters: 100,
    baseSalary: 30000,
    checkInTimeHours: 9,
    checkInTimeMinutes: 0,
    checkOutTimeHours: 17,
    checkOutTimeMinutes: 0,
    weekOffs: [1, 7] // 1 = Sun, 7 = Sat matching Java Calendar
  };
}

// --- Android validateAttendance Implementation ---
function validateAttendance(type) {
  if (!currentUser) return "Please log in first.";
  const email = currentUser.email.toLowerCase();
  const settings = getMySettings();
  const now = new Date();

  // 1. Check if already marked today
  const hasMarkedToday = attendances.some(a => {
    if (a.employeeId.toLowerCase() !== email || a.type !== type) return false;
    const d = new Date(a.timestamp);
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  });

  if (hasMarkedToday) {
    return `You have already marked ${type} today.`;
  }

  // 2. Check week off (1 = Sunday, 7 = Saturday)
  const currentDayOfWeek = now.getDay() + 1; // JS 0 = Sun -> 1, 6 = Sat -> 7
  const weekOffs = settings.weekOffs || [1, 7];
  if (weekOffs.includes(currentDayOfWeek)) {
    return "You cannot mark attendance on your week off.";
  }

  // 3. Validate 1-hour time window
  const scheduledTime = new Date(now.getTime());
  if (type === "IN") {
    scheduledTime.setHours(settings.checkInTimeHours ?? 9, settings.checkInTimeMinutes ?? 0, 0, 0);
  } else {
    scheduledTime.setHours(settings.checkOutTimeHours ?? 17, settings.checkOutTimeMinutes ?? 0, 0, 0);
  }

  const diffMs = Math.abs(now.getTime() - scheduledTime.getTime());
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours > 1.0) {
    const h = String(type === "IN" ? (settings.checkInTimeHours ?? 9) : (settings.checkOutTimeHours ?? 17)).padStart(2, "0");
    const m = String(type === "IN" ? (settings.checkInTimeMinutes ?? 0) : (settings.checkOutTimeMinutes ?? 0)).padStart(2, "0");
    return `You can only mark ${type} within 1 hour of your scheduled time (${h}:${m}).`;
  }

  return null;
}

// --- Language Toggle Logic ---
const btnLangToggle = document.getElementById("btn-lang-toggle");
if (btnLangToggle) {
  btnLangToggle.addEventListener("click", () => {
    isHindi = !isHindi;
    btnLangToggle.textContent = isHindi ? "English" : "हिंदी";
    applyTranslations();
  });
}

function applyTranslations() {
  const lblEmail = document.getElementById("lbl-email");
  if (lblEmail) lblEmail.textContent = t("Email");

  const lblPassword = document.getElementById("lbl-password");
  if (lblPassword) lblPassword.textContent = t("Password");

  const txtLoginBtn = document.getElementById("txt-login-btn");
  if (txtLoginBtn) {
    txtLoginBtn.textContent = isSignUpMode 
      ? (isHindi ? "खाता बनाएं" : "Create Account")
      : (isHindi ? "लॉग इन करें" : "Login");
  }

  const btnSignUpToggle = document.getElementById("btn-signup-toggle");
  if (btnSignUpToggle) {
    btnSignUpToggle.textContent = isSignUpMode 
      ? (isHindi ? "पहले से खाता है? लॉग इन करें" : "Already have an account? Login")
      : (isHindi ? "नया उपयोगकर्ता? खाता बनाएं" : "New user? Tap to Register / Sign Up");
  }

  const btnClockIn = document.getElementById("btn-clock-in");
  if (btnClockIn) btnClockIn.textContent = t("In");

  const btnClockOut = document.getElementById("btn-clock-out");
  if (btnClockOut) btnClockOut.textContent = t("Out");

  const btnViewAtt = document.getElementById("btn-view-attendance");
  if (btnViewAtt) btnViewAtt.textContent = t("View My Attendance");

  const btnReqLeave = document.getElementById("btn-request-leave");
  if (btnReqLeave) btnReqLeave.textContent = t("Request Leave");

  const btnSalCalc = document.getElementById("btn-salary-calc");
  if (btnSalCalc) btnSalCalc.textContent = t("Salary Calculator");

  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) btnLogout.textContent = t("Logout");

  const btnEditProf = document.getElementById("btn-edit-profile");
  if (btnEditProf) btnEditProf.textContent = t("Edit Profile");

  updateWelcomeText();
  updateLiveClock();
}

function updateWelcomeText() {
  const welcomeEl = document.getElementById("main-welcome-text");
  if (!welcomeEl || !currentUser) return;
  const settings = getMySettings();
  const name = settings.displayName || currentUser.email.split("@")[0];
  welcomeEl.textContent = isHindi ? `स्वागत है, ${name}` : `Welcome, ${name}`;
}

// --- Toggle Login / Sign Up Mode ---
const btnSignupToggle = document.getElementById("btn-signup-toggle");
if (btnSignupToggle) {
  btnSignupToggle.addEventListener("click", () => {
    isSignUpMode = !isSignUpMode;
    hideAuthBanners();
    applyTranslations();
  });
}

function hideAuthBanners() {
  const errBanner = document.getElementById("login-error-banner");
  const succBanner = document.getElementById("login-success-banner");
  if (errBanner) {
    errBanner.style.display = "none";
    errBanner.innerHTML = "";
  }
  if (succBanner) {
    succBanner.style.display = "none";
    succBanner.innerHTML = "";
  }
}

function showAuthError(message, showRegisterFallback = false, email = "", pass = "") {
  const errBanner = document.getElementById("login-error-banner");
  if (!errBanner) return;
  errBanner.style.display = "block";

  if (showRegisterFallback && email && pass) {
    errBanner.innerHTML = `
      <div><strong>Login Failed:</strong> ${message}</div>
      <div style="margin-top: 10px;">
        <button type="button" id="btn-quick-register" style="background: #E53935; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer;">
          Create new account for ${email}
        </button>
      </div>
    `;
    const quickBtn = document.getElementById("btn-quick-register");
    if (quickBtn) {
      quickBtn.addEventListener("click", () => performRegistration(email, pass));
    }
  } else {
    errBanner.textContent = message;
  }
}

function showAuthSuccess(message) {
  const succBanner = document.getElementById("login-success-banner");
  if (!succBanner) return;
  succBanner.style.display = "block";
  succBanner.textContent = message;
}

// --- Perform Registration Helper ---
async function performRegistration(email, pass) {
  const btn = document.getElementById("btn-login-submit");
  const txtBtn = document.getElementById("txt-login-btn");
  if (btn) btn.disabled = true;
  if (txtBtn) txtBtn.textContent = "Creating Account...";
  hideAuthBanners();

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    showAuthSuccess("Account created successfully! Logging in...");
    const db = getDb();
    const newEmpId = cred.user.email.toLowerCase();
    await setDoc(doc(db, "settings", newEmpId), {
      employeeId: newEmpId,
      displayName: newEmpId.split("@")[0],
      baseSalary: 30000,
      checkInTimeHours: 9,
      checkInTimeMinutes: 0,
      checkOutTimeHours: 17,
      checkOutTimeMinutes: 0,
      weekOffs: [1, 7],
      targetLatitude: 0,
      targetLongitude: 0,
      targetRadiusMeters: 100
    }, { merge: true });
  } catch (err) {
    console.error("Registration error:", err);
    let msg = err.message || "Failed to create account.";
    if (err.code === "auth/email-already-in-use") {
      msg = "Email is already registered. Please enter your existing password to log in.";
    } else if (err.code === "auth/weak-password") {
      msg = "Password should be at least 6 characters.";
    } else if (err.code === "auth/invalid-email") {
      msg = "Invalid email format.";
    }
    showAuthError(msg);
  } finally {
    if (btn) btn.disabled = false;
    applyTranslations();
  }
}

// --- Login Form Submit Handler ---
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-password").value;
    const btn = document.getElementById("btn-login-submit");
    const txtBtn = document.getElementById("txt-login-btn");

    if (!email || !pass) {
      showAuthError("Please enter both email and password.");
      return;
    }

    hideAuthBanners();
    if (btn) btn.disabled = true;
    if (txtBtn) txtBtn.textContent = isSignUpMode ? "Registering..." : "Authenticating...";

    if (isSignUpMode) {
      await performRegistration(email, pass);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      console.error("Sign-in error:", err);
      let msg = err.message || "Login failed.";
      let offerRegistration = false;

      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.message?.includes("INVALID_LOGIN_CREDENTIALS")) {
        msg = "Account not found or password incorrect.";
        offerRegistration = true;
      } else if (err.code === "auth/wrong-password") {
        msg = "Incorrect password. Please try again.";
      } else if (err.code === "auth/network-request-failed") {
        msg = "Network error. Please check your internet connection.";
      }

      showAuthError(msg, offerRegistration, email, pass);
    } finally {
      if (btn) btn.disabled = false;
      applyTranslations();
    }
  });
}

// --- Auth State Observer ---
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    const userEmail = (user.email || "").toLowerCase();
    isAdmin = userEmail === "admin" || userEmail === "mahimsinhsingoria@gmail.com";
    setupFirestoreListeners(userEmail);
    updateWelcomeText();

    if (isAdmin) {
      showView(viewAdmin);
      renderAdminDashboard();
    } else {
      showView(viewMain);
    }
  } else {
    detachListeners();
    showView(viewLogin);
    hideAuthBanners();
    applyTranslations();
  }
});

// Logout Handlers
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    if (confirm("Are you sure you want to log out?")) {
      signOut(auth);
    }
  });
}

const btnAdminLogout = document.getElementById("btn-admin-logout");
if (btnAdminLogout) {
  btnAdminLogout.addEventListener("click", () => {
    if (confirm("Are you sure you want to log out?")) {
      signOut(auth);
    }
  });
}

// --- Navigation Handlers ---
const btnEditProfile = document.getElementById("btn-edit-profile");
if (btnEditProfile) {
  btnEditProfile.addEventListener("click", openProfile);
}

const btnBackFromProfile = document.getElementById("btn-back-from-profile");
if (btnBackFromProfile) {
  btnBackFromProfile.addEventListener("click", () => showView(isAdmin ? viewAdmin : viewMain));
}

const btnViewAttendance = document.getElementById("btn-view-attendance");
if (btnViewAttendance) {
  btnViewAttendance.addEventListener("click", () => {
    showView(viewHistory);
    renderAttendanceCalendar();
  });
}

const btnBackFromHistory = document.getElementById("btn-back-from-history");
if (btnBackFromHistory) {
  btnBackFromHistory.addEventListener("click", () => showView(isAdmin ? viewAdmin : viewMain));
}

const btnRequestLeave = document.getElementById("btn-request-leave");
if (btnRequestLeave) {
  btnRequestLeave.addEventListener("click", () => {
    showView(viewLeave);
    renderLeaveRequests();
  });
}

const btnBackFromLeave = document.getElementById("btn-back-from-leave");
if (btnBackFromLeave) {
  btnBackFromLeave.addEventListener("click", () => showView(isAdmin ? viewAdmin : viewMain));
}

const btnSalaryCalc = document.getElementById("btn-salary-calc");
if (btnSalaryCalc) {
  btnSalaryCalc.addEventListener("click", () => {
    showView(viewSalary);
    renderSalaryReport();
  });
}

const btnBackFromSalary = document.getElementById("btn-back-from-salary");
if (btnBackFromSalary) {
  btnBackFromSalary.addEventListener("click", () => showView(isAdmin ? viewAdmin : viewMain));
}

const fabChatBtn = document.getElementById("fab-chat-btn");
if (fabChatBtn) {
  fabChatBtn.addEventListener("click", () => {
    activeChatPartner = null;
    const title = document.getElementById("chat-title");
    if (title) title.textContent = isAdmin ? "Messages" : "Chat with Admin";
    showView(viewChat);
    renderChatMessages();
  });
}

const fabAdminChatBtn = document.getElementById("fab-admin-chat-btn");
if (fabAdminChatBtn) {
  fabAdminChatBtn.addEventListener("click", () => {
    activeChatPartner = null;
    const title = document.getElementById("chat-title");
    if (title) title.textContent = "Chat / Messages";
    showView(viewChat);
    renderChatMessages();
  });
}

const btnBackFromChat = document.getElementById("btn-back-from-chat");
if (btnBackFromChat) {
  btnBackFromChat.addEventListener("click", () => showView(isAdmin ? viewAdmin : viewMain));
}

// --- Firestore Realtime Listeners ---
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
      db = fallbackToDefaultDb();
      setupFirestoreListeners(email);
    }
  };

  try {
    // 1. Settings listener
    const settingsCol = collection(db, "settings");
    unsubSettings = onSnapshot(settingsCol, (snap) => {
      employeeSettingsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateWelcomeText();
      refreshAdminViews();
    }, (err) => handleListenerError(err, "settings"));

    // 2. Attendances listener
    const attendancesCol = collection(db, "attendances");
    const attQuery = isAdmin ? attendancesCol : query(attendancesCol, where("employeeId", "==", email));
    unsubAttendances = onSnapshot(attQuery, (snap) => {
      attendances = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      renderAttendanceCalendar();
      renderSalaryReport();
      refreshAdminViews();
    }, (err) => handleListenerError(err, "attendances"));

    // 3. Leave Requests listener
    const leavesCol = collection(db, "leaveRequests");
    const leaveQuery = isAdmin ? leavesCol : query(leavesCol, where("employeeId", "==", email));
    unsubLeaves = onSnapshot(leaveQuery, (snap) => {
      leaveRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.requestedAtTimestamp || 0) - (a.requestedAtTimestamp || 0));
      renderLeaveRequests();
      refreshAdminViews();
    }, (err) => handleListenerError(err, "leaveRequests"));

    // 4. Messages listener
    const messagesCol = collection(db, "messages");
    unsubMessages = onSnapshot(messagesCol, (snap) => {
      chatMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      renderChatMessages();
    }, (err) => handleListenerError(err, "messages"));

  } catch (err) {
    console.error("Error setting up listeners:", err);
  }
}

// --- Attendance Camera & Geofence Modal ---
const modalCamera = document.getElementById("modal-attendance-camera");
const cameraVideo = document.getElementById("live-camera-video");
const cameraCanvas = document.getElementById("live-camera-canvas");
const cameraPhotoPreview = document.getElementById("captured-photo-display");
const btnCapturePhoto = document.getElementById("btn-camera-capture");
const btnRetakePhoto = document.getElementById("btn-camera-retake");
const btnSubmitAttendance = document.getElementById("btn-attendance-submit");
const cameraFallback = document.getElementById("file-upload-fallback");
const cameraFileInput = document.getElementById("fallback-file-input");

async function openAttendanceModal(type) {
  // Run exact Android validation before opening camera!
  const validationError = validateAttendance(type);
  if (validationError) {
    alert(validationError);
    return;
  }

  clockActionType = type;
  capturedPhotoBase64 = null;

  const titleEl = document.getElementById("modal-action-title");
  if (titleEl) titleEl.textContent = `Mark Attendance - ${type}`;

  if (cameraPhotoPreview) cameraPhotoPreview.style.display = "none";
  if (cameraVideo) cameraVideo.style.display = "block";
  if (btnCapturePhoto) btnCapturePhoto.style.display = "inline-flex";
  if (btnRetakePhoto) btnRetakePhoto.style.display = "none";
  if (btnSubmitAttendance) btnSubmitAttendance.style.display = "none";

  const geofenceAlert = document.getElementById("geofence-alert");
  const mySettings = getMySettings();

  if (currentGpsLocation && mySettings.targetLatitude !== 0 && mySettings.targetLongitude !== 0) {
    const dist = calculateDistanceMeters(
      currentGpsLocation.lat,
      currentGpsLocation.lon,
      mySettings.targetLatitude,
      mySettings.targetLongitude
    );
    const limit = mySettings.targetRadiusMeters || 100;
    if (dist <= limit) {
      if (geofenceAlert) geofenceAlert.textContent = `Within Geofence (${Math.round(dist)}m to office)`;
    } else {
      if (geofenceAlert) geofenceAlert.textContent = `Warning: ${Math.round(dist)}m away from office (allowed limit: ${limit}m)`;
    }
  } else {
    if (geofenceAlert) geofenceAlert.textContent = "Acquiring GPS location...";
  }

  if (modalCamera) modalCamera.classList.add("open");

  // Start Camera Stream
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      if (cameraVideo) {
        cameraVideo.srcObject = mediaStream;
        cameraVideo.style.display = "block";
      }
      if (cameraFallback) cameraFallback.style.display = "none";
    } else {
      if (cameraFallback) cameraFallback.style.display = "block";
    }
  } catch (err) {
    console.warn("Camera access failed, showing fallback upload:", err);
    if (cameraFallback) cameraFallback.style.display = "block";
    if (cameraVideo) cameraVideo.style.display = "none";
  }
}

function closeCameraModal() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (modalCamera) modalCamera.classList.remove("open");
}

const btnClockIn = document.getElementById("btn-clock-in");
if (btnClockIn) btnClockIn.addEventListener("click", () => openAttendanceModal("IN"));

const btnClockOut = document.getElementById("btn-clock-out");
if (btnClockOut) btnClockOut.addEventListener("click", () => openAttendanceModal("OUT"));

const btnCloseCamera = document.getElementById("btn-close-camera-modal");
if (btnCloseCamera) btnCloseCamera.addEventListener("click", closeCameraModal);

if (btnCapturePhoto) {
  btnCapturePhoto.addEventListener("click", () => {
    if (cameraVideo && cameraVideo.srcObject) {
      const w = cameraVideo.videoWidth || 400;
      const h = cameraVideo.videoHeight || 300;
      cameraCanvas.width = Math.min(w, 400);
      cameraCanvas.height = Math.round(h * (cameraCanvas.width / w));
      const ctx = cameraCanvas.getContext("2d");
      ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
      capturedPhotoBase64 = cameraCanvas.toDataURL("image/jpeg", 0.7);

      if (cameraPhotoPreview) {
        cameraPhotoPreview.src = capturedPhotoBase64;
        cameraPhotoPreview.style.display = "block";
      }
      cameraVideo.style.display = "none";
      btnCapturePhoto.style.display = "none";
      if (btnRetakePhoto) btnRetakePhoto.style.display = "inline-flex";
      if (btnSubmitAttendance) btnSubmitAttendance.style.display = "inline-flex";
    }
  });
}

if (btnRetakePhoto) {
  btnRetakePhoto.addEventListener("click", () => {
    capturedPhotoBase64 = null;
    if (cameraPhotoPreview) cameraPhotoPreview.style.display = "none";
    if (cameraVideo) cameraVideo.style.display = "block";
    if (btnCapturePhoto) btnCapturePhoto.style.display = "inline-flex";
    btnRetakePhoto.style.display = "none";
    if (btnSubmitAttendance) btnSubmitAttendance.style.display = "none";
  });
}

if (cameraFileInput) {
  cameraFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      capturedPhotoBase64 = ev.target.result;
      if (cameraPhotoPreview) {
        cameraPhotoPreview.src = capturedPhotoBase64;
        cameraPhotoPreview.style.display = "block";
      }
      if (cameraFallback) cameraFallback.style.display = "none";
      if (btnCapturePhoto) btnCapturePhoto.style.display = "none";
      if (btnRetakePhoto) btnRetakePhoto.style.display = "inline-flex";
      if (btnSubmitAttendance) btnSubmitAttendance.style.display = "inline-flex";
    };
    reader.readAsDataURL(file);
  });
}

// Attendance Submit
if (btnSubmitAttendance) {
  btnSubmitAttendance.addEventListener("click", async () => {
    if (!currentUser) return;
    const mySettings = getMySettings();

    // Android Geofence distance validation
    if (currentGpsLocation && mySettings.targetLatitude !== 0 && mySettings.targetLongitude !== 0) {
      const dist = calculateDistanceMeters(
        currentGpsLocation.lat,
        currentGpsLocation.lon,
        mySettings.targetLatitude,
        mySettings.targetLongitude
      );
      const limit = mySettings.targetRadiusMeters || 100;
      if (dist > limit) {
        alert(`You are too far from the attendance location. Distance: ${Math.round(dist)}m (allowed: ${limit}m)`);
        return;
      }
    }

    btnSubmitAttendance.disabled = true;
    btnSubmitAttendance.textContent = "Saving...";

    const newId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `att_${Date.now()}`;
    const record = {
      id: newId,
      employeeId: currentUser.email.toLowerCase(),
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
      console.error("Failed to save to attend db, retrying with fallback:", e);
      try {
        const fallbackDb = fallbackToDefaultDb();
        await setDoc(doc(fallbackDb, "attendances", newId), record);
        alert(`Success! Marked ${clockActionType}`);
        closeCameraModal();
      } catch (err2) {
        alert(`Error saving attendance: ${err2.message}`);
      }
    } finally {
      btnSubmitAttendance.disabled = false;
      btnSubmitAttendance.textContent = "Confirm & Submit";
    }
  });
}

// --- Interactive Attendance Calendar (Matches Android CalendarAttendanceView) ---
const btnCalPrev = document.getElementById("btn-cal-prev");
const btnCalNext = document.getElementById("btn-cal-next");
if (btnCalPrev) {
  btnCalPrev.addEventListener("click", () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderAttendanceCalendar();
  });
}
if (btnCalNext) {
  btnCalNext.addEventListener("click", () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderAttendanceCalendar();
  });
}

function renderAttendanceCalendar() {
  const monthTitle = document.getElementById("cal-month-title");
  const gridContainer = document.getElementById("cal-grid-container");
  const recordsContainer = document.getElementById("history-container");
  const selectedDateTitle = document.getElementById("history-selected-date-title");

  if (!gridContainer) return;

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (monthTitle) monthTitle.textContent = `${monthNames[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const totalDays = new Date(year, month + 1, 0).getDate();

  const dayHeaders = ["S", "M", "T", "W", "T", "F", "S"];
  let html = dayHeaders.map(h => `<div style="font-weight: 700; color: #9E9E9E; font-size: 0.75rem; padding: 4px 0;">${h}</div>`).join("");

  // Empty slots before month start
  for (let i = 0; i < firstDayIndex; i++) {
    html += `<div></div>`;
  }

  const mySettings = getMySettings();
  const weekOffs = mySettings.weekOffs || [1, 7];
  const userEmail = (currentUser?.email || "").toLowerCase();

  const userAtts = attendances.filter(a => a.employeeId.toLowerCase() === userEmail);
  const userLeaves = leaveRequests.filter(l => l.employeeId.toLowerCase() === userEmail && l.status === "APPROVED");

  const today = new Date();
  today.setHours(0,0,0,0);

  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month, day);
    const dayOfWeek = d.getDay() + 1; // 1 = Sun, 7 = Sat

    let dotColor = "transparent";
    const isWeekOff = weekOffs.includes(dayOfWeek);
    const hasAtt = userAtts.some(a => {
      const ad = new Date(a.timestamp);
      return ad.getFullYear() === year && ad.getMonth() === month && ad.getDate() === day;
    });

    const hasLeave = userLeaves.some(l => {
      const ld = new Date(l.dateTimestamp);
      return ld.getFullYear() === year && ld.getMonth() === month && ld.getDate() === day;
    });

    if (isWeekOff) {
      dotColor = "#9E9E9E"; // Week off
    } else if (hasAtt) {
      dotColor = "#2E7D32"; // Present
    } else if (hasLeave) {
      dotColor = "#FB8C00"; // Leave
    } else if (d < today) {
      dotColor = "#E53935"; // Absent
    }

    const isSelected = selectedCalendarDate.getFullYear() === year &&
                       selectedCalendarDate.getMonth() === month &&
                       selectedCalendarDate.getDate() === day;

    html += `
      <div class="cal-day-cell" data-day="${day}" style="padding: 4px 0; cursor: pointer; border-radius: 8px; ${isSelected ? 'background: #FFEBEE;' : ''}">
        <div style="font-size: 0.85rem; font-weight: ${isSelected ? '700' : '400'}; color: ${isSelected ? '#E53935' : '#1C1B1F'};">${day}</div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background: ${dotColor}; margin: 2px auto 0;"></div>
      </div>
    `;
  }

  gridContainer.innerHTML = html;

  // Bind Day click
  gridContainer.querySelectorAll(".cal-day-cell").forEach(cell => {
    cell.addEventListener("click", () => {
      const dayNum = parseInt(cell.getAttribute("data-day"));
      selectedCalendarDate = new Date(year, month, dayNum);
      renderAttendanceCalendar();
    });
  });

  // Render Attendances for selected date
  const selDateFormatted = selectedCalendarDate.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  if (selectedDateTitle) selectedDateTitle.textContent = `Records for ${selDateFormatted}`;

  const dayAtts = userAtts.filter(a => {
    const d = new Date(a.timestamp);
    return d.getFullYear() === selectedCalendarDate.getFullYear() &&
           d.getMonth() === selectedCalendarDate.getMonth() &&
           d.getDate() === selectedCalendarDate.getDate();
  });

  if (dayAtts.length === 0) {
    recordsContainer.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 20px 0;">No attendance records for this date.</div>`;
    return;
  }

  recordsContainer.innerHTML = dayAtts.map(a => {
    const d = new Date(a.timestamp);
    const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isClockIn = a.type === "IN";
    const badgeColor = isClockIn ? "#2E7D32" : "#E53935";
    const photo = a.photoUri ? `<img src="${a.photoUri}" class="history-thumb" alt="Selfie">` : `<div class="history-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.4rem;">📷</div>`;

    return `
      <div class="history-card">
        ${photo}
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: 700; color: ${badgeColor}; font-size: 1.05rem;">${a.type}</span>
            <span style="font-size: 0.85rem; color: var(--text-secondary);">${timeFormatted}</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-secondary);">${a.latitude ? `GPS: ${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}` : "No GPS data"}</div>
        </div>
      </div>
    `;
  }).join("");
}

// --- Leave Requests View ---
const leaveForm = document.getElementById("request-leave-form");
if (leaveForm) {
  leaveForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const dateVal = document.getElementById("input-leave-date").value;
    const reasonVal = document.getElementById("input-leave-reason").value.trim();
    const btnSubmit = document.getElementById("btn-submit-leave");

    if (!dateVal || !reasonVal) return;

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Submitting...";

    const newId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `leave_${Date.now()}`;
    const targetDate = new Date(dateVal).getTime();

    const leaveObj = {
      id: newId,
      employeeId: currentUser.email.toLowerCase(),
      dateTimestamp: targetDate,
      reason: reasonVal,
      status: "PENDING",
      requestedAtTimestamp: Date.now()
    };

    try {
      const db = getDb();
      await setDoc(doc(db, "leaveRequests", newId), leaveObj);
      alert("Leave request submitted successfully!");
      leaveForm.reset();
    } catch (err) {
      console.error("Leave request error:", err);
      try {
        const fallbackDb = fallbackToDefaultDb();
        await setDoc(doc(fallbackDb, "leaveRequests", newId), leaveObj);
        alert("Leave request submitted successfully!");
        leaveForm.reset();
      } catch (err2) {
        alert("Failed to submit request: " + err2.message);
      }
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = t("Submit Request");
    }
  });
}

function renderLeaveRequests() {
  const container = document.getElementById("leaves-history-container");
  if (!container) return;

  if (leaveRequests.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 20px 0;">No leave requests.</div>`;
    return;
  }

  container.innerHTML = leaveRequests.map(l => {
    const d = new Date(l.dateTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    let statusBg = "#FFF3E0";
    let statusColor = "#E65100";
    if (l.status === "APPROVED") {
      statusBg = "#E8F5E9";
      statusColor = "#2E7D32";
    } else if (l.status === "REJECTED") {
      statusBg = "#FFEBEE";
      statusColor = "#C62828";
    }

    return `
      <div style="background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 12px; padding: 14px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-weight: 600; font-size: 0.95rem;">${d}</span>
          <span style="background: ${statusBg}; color: ${statusColor}; font-size: 0.78rem; font-weight: 700; padding: 4px 8px; border-radius: 6px;">${l.status}</span>
        </div>
        <div style="color: var(--text-secondary); font-size: 0.88rem;">Reason: "${l.reason}"</div>
      </div>
    `;
  }).join("");
}

// --- Salary Calculator View ---
const salaryMonthSelect = document.getElementById("salary-month-select");
if (salaryMonthSelect) {
  const now = new Date();
  salaryMonthSelect.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  salaryMonthSelect.addEventListener("change", renderSalaryReport);
}

function renderSalaryReport() {
  const monthInput = document.getElementById("salary-month-select");
  if (!monthInput || !monthInput.value) return;

  const [yearStr, monthStr] = monthInput.value.split("-");
  const year = parseInt(yearStr);
  const monthIndex = parseInt(monthStr) - 1;

  const mySettings = getMySettings();
  const baseSalary = mySettings.baseSalary || 30000;

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const weekOffs = mySettings.weekOffs || [1, 7];

  let totalWorkingDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    const dayOfWeek = d.getDay() + 1; // 1 = Sun, 7 = Sat
    if (!weekOffs.includes(dayOfWeek)) {
      totalWorkingDays++;
    }
  }

  const userAtts = attendances.filter(a => {
    const d = new Date(a.timestamp);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });

  const presentDates = new Set();
  userAtts.forEach(a => {
    const d = new Date(a.timestamp);
    presentDates.add(d.getDate());
  });
  const daysPresent = presentDates.size;

  const approvedLeaves = leaveRequests.filter(l => {
    if (l.status !== "APPROVED") return false;
    const d = new Date(l.dateTimestamp);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  }).length;

  const effectivePresent = Math.min(totalWorkingDays, daysPresent + approvedLeaves);
  const daysAbsent = Math.max(0, totalWorkingDays - effectivePresent);
  const perDaySalary = totalWorkingDays > 0 ? baseSalary / totalWorkingDays : 0;
  const deduction = daysAbsent * perDaySalary;
  const netSalary = Math.max(0, baseSalary - deduction);

  const dispBase = document.getElementById("disp-base-salary");
  if (dispBase) dispBase.textContent = `Base Salary: ₹${baseSalary.toLocaleString()}`;

  const dispWorking = document.getElementById("disp-working-days");
  if (dispWorking) dispWorking.textContent = `Total Working Days (Month): ${totalWorkingDays}`;

  const dispPresent = document.getElementById("disp-present-days");
  if (dispPresent) dispPresent.textContent = `Days Present: ${daysPresent}`;

  const dispApproved = document.getElementById("disp-approved-leaves");
  if (dispApproved) dispApproved.textContent = `Approved Leaves: ${approvedLeaves}`;

  const dispAbsent = document.getElementById("disp-absent-days");
  if (dispAbsent) dispAbsent.textContent = `Days Absent: ${daysAbsent}`;

  const dispPerDay = document.getElementById("disp-per-day");
  if (dispPerDay) dispPerDay.textContent = `Per Day Salary: ₹${Math.round(perDaySalary).toLocaleString()}`;

  const dispDeduct = document.getElementById("disp-deduction");
  if (dispDeduct) dispDeduct.textContent = `Total Deduction: ₹${Math.round(deduction).toLocaleString()}`;

  const dispNet = document.getElementById("disp-net-salary");
  if (dispNet) dispNet.textContent = `Estimated Net Salary: ₹${Math.round(netSalary).toLocaleString()}`;
}

const btnExportCsv = document.getElementById("btn-export-csv-sal");
if (btnExportCsv) {
  btnExportCsv.addEventListener("click", () => {
    exportMonthlyCsv();
  });
}

const btnAdminExportCsv = document.getElementById("btn-admin-export-csv");
if (btnAdminExportCsv) {
  btnAdminExportCsv.addEventListener("click", () => {
    exportMonthlyCsv();
  });
}

function exportMonthlyCsv() {
  const employees = Array.from(new Set([
    ...employeeSettingsList.map(s => s.employeeId.toLowerCase()),
    ...attendances.map(a => a.employeeId.toLowerCase())
  ])).filter(e => e !== "admin");

  let csv = "Employee Name,Base Salary,Total Working Days,Days Present,Approved Leaves,Days Absent,Per Day Salary,Deduction,Net Salary\n";
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  employees.forEach(empId => {
    const s = getMySettings(empId);
    const base = s.baseSalary || 30000;
    const weekOffs = s.weekOffs || [1, 7];

    let workingDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      if (!weekOffs.includes(d.getDay() + 1)) workingDays++;
    }

    const empAtts = attendances.filter(a => a.employeeId.toLowerCase() === empId);
    const presentDates = new Set();
    empAtts.forEach(a => {
      const d = new Date(a.timestamp);
      if (d.getFullYear() === year && d.getMonth() === month) {
        presentDates.add(d.getDate());
      }
    });

    const approvedLeaves = leaveRequests.filter(l => {
      if (l.employeeId.toLowerCase() !== empId || l.status !== "APPROVED") return false;
      const d = new Date(l.dateTimestamp);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;

    const presentDays = presentDates.size;
    const effectivePresent = Math.min(workingDays, presentDays + approvedLeaves);
    const absentDays = Math.max(0, workingDays - effectivePresent);
    const perDay = workingDays > 0 ? base / workingDays : 0;
    const deduct = absentDays * perDay;
    const net = Math.max(0, base - deduct);

    csv += `"${s.displayName || empId}",${base},${workingDays},${presentDays},${approvedLeaves},${absentDays},${Math.round(perDay)},${Math.round(deduct)},${Math.round(net)}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `monthly_report_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- Chat View ---
const chatForm = document.getElementById("chat-form");
if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const inputEl = document.getElementById("chat-input-msg");
    const text = inputEl.value.trim();
    if (!text) return;

    const newId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `msg_${Date.now()}`;
    const receiver = activeChatPartner || (isAdmin ? "all" : "admin");

    const messageObj = {
      id: newId,
      senderId: currentUser.email.toLowerCase(),
      receiverId: receiver,
      content: text,
      timestamp: Date.now(),
      isRead: false
    };

    inputEl.value = "";
    try {
      const db = getDb();
      await setDoc(doc(db, "messages", newId), messageObj);
    } catch (err) {
      const fallbackDb = fallbackToDefaultDb();
      await setDoc(doc(fallbackDb, "messages", newId), messageObj);
    }
  });
}

function renderChatMessages() {
  const container = document.getElementById("chat-thread-container");
  if (!container || !currentUser) return;

  const currentEmail = currentUser.email.toLowerCase();
  const relevant = chatMessages.filter(m => {
    if (isAdmin) {
      if (activeChatPartner) {
        return (m.senderId === activeChatPartner && m.receiverId === currentEmail) ||
               (m.senderId === currentEmail && m.receiverId === activeChatPartner);
      }
      return true;
    }
    return m.senderId === currentEmail || m.receiverId === currentEmail || m.receiverId === "all";
  });

  if (relevant.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-secondary); padding: 40px 0;">No messages yet.</div>`;
    return;
  }

  container.innerHTML = relevant.map(m => {
    const isMine = m.senderId === currentEmail;
    const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">
        ${!isMine ? `<div style="font-size:0.75rem; font-weight:600; opacity:0.8; margin-bottom:2px;">${m.senderId.split("@")[0]}</div>` : ''}
        <div>${m.content}</div>
        <div style="font-size:0.7rem; opacity:0.7; text-align:right; margin-top:4px;">${time}</div>
      </div>
    `;
  }).join("");

  container.scrollTop = container.scrollHeight;
}

// --- Profile View ---
function openProfile() {
  if (!currentUser) return;
  const emailDisp = document.getElementById("profile-email-disp");
  const nameDisp = document.getElementById("profile-display-name");
  const avatarPreview = document.getElementById("avatar-preview");

  if (emailDisp) emailDisp.value = currentUser.email;
  const settings = getMySettings();
  if (nameDisp) nameDisp.value = settings.displayName || currentUser.email.split("@")[0];
  if (avatarPreview && settings.profilePhotoUri) {
    avatarPreview.src = settings.profilePhotoUri;
  }
  showView(viewProfile);
}

const profileEditForm = document.getElementById("profile-edit-form");
if (profileEditForm) {
  profileEditForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const newName = document.getElementById("profile-display-name").value.trim();
    const avatarPreview = document.getElementById("avatar-preview");
    const photoUri = avatarPreview ? avatarPreview.src : "";

    try {
      const db = getDb();
      await setDoc(doc(db, "settings", currentUser.email.toLowerCase()), {
        employeeId: currentUser.email.toLowerCase(),
        displayName: newName,
        profilePhotoUri: photoUri
      }, { merge: true });
      alert("Profile updated successfully!");
      updateWelcomeText();
      showView(isAdmin ? viewAdmin : viewMain);
    } catch (err) {
      console.error("Profile save error:", err);
      alert("Failed to update profile: " + err.message);
    }
  });
}

const avatarFileInput = document.getElementById("avatar-file-input");
if (avatarFileInput) {
  avatarFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const avatarPreview = document.getElementById("avatar-preview");
      if (avatarPreview) avatarPreview.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// --- ADMIN DASHBOARD & SCREENS (100% Matches Android Material 3 UI & Working) ---

let reportSelectedYear = new Date().getFullYear();
let reportSelectedMonth = new Date().getMonth();

function refreshAdminViews() {
  if (!isAdmin) return;
  renderAdminDashboard();
  if (viewAdminLeaves && viewAdminLeaves.classList.contains("active")) {
    renderAdminLeavesList();
  }
  if (viewAdminReport && viewAdminReport.classList.contains("active")) {
    renderMonthlyReportScreen();
  }
}

// 1. Navigation Button Event Handlers
const btnAdminToLeaves = document.getElementById("btn-admin-to-leaves");
if (btnAdminToLeaves) {
  btnAdminToLeaves.addEventListener("click", () => {
    showView(viewAdminLeaves);
    renderAdminLeavesList();
  });
}

const btnBackFromAdminLeaves = document.getElementById("btn-back-from-admin-leaves");
if (btnBackFromAdminLeaves) {
  btnBackFromAdminLeaves.addEventListener("click", () => {
    showView(viewAdmin);
  });
}

const btnAdminToReport = document.getElementById("btn-admin-to-report");
if (btnAdminToReport) {
  btnAdminToReport.addEventListener("click", () => {
    showView(viewAdminReport);
    renderMonthlyReportScreen();
  });
}

const btnBackFromAdminReport = document.getElementById("btn-back-from-admin-report");
if (btnBackFromAdminReport) {
  btnBackFromAdminReport.addEventListener("click", () => {
    showView(viewAdmin);
  });
}

const btnBackFromAdminDetail = document.getElementById("btn-back-from-admin-detail");
if (btnBackFromAdminDetail) {
  btnBackFromAdminDetail.addEventListener("click", () => {
    showView(viewAdmin);
  });
}

// Month Navigation for Monthly Report (◀ Month Year ▶)
const btnReportPrevMonth = document.getElementById("btn-report-prev-month");
if (btnReportPrevMonth) {
  btnReportPrevMonth.addEventListener("click", () => {
    if (reportSelectedMonth === 0) {
      reportSelectedMonth = 11;
      reportSelectedYear--;
    } else {
      reportSelectedMonth--;
    }
    renderMonthlyReportScreen();
  });
}

const btnReportNextMonth = document.getElementById("btn-report-next-month");
if (btnReportNextMonth) {
  btnReportNextMonth.addEventListener("click", () => {
    if (reportSelectedMonth === 11) {
      reportSelectedMonth = 0;
      reportSelectedYear++;
    } else {
      reportSelectedMonth++;
    }
    renderMonthlyReportScreen();
  });
}

// 2. Salary Calculation (Exact formula from Android MainScreenViewModel.kt)
function calculateSalaryForEmployee(empId, year, month) {
  const s = getMySettings(empId);
  const baseSalary = s.baseSalary || 30000;
  const weekOffs = s.weekOffs || [1, 7];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let totalWorkingDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const dayOfWeek = d.getDay() + 1; // 1 = Sun, 7 = Sat
    if (!weekOffs.includes(dayOfWeek)) {
      totalWorkingDays++;
    }
  }

  const empAtts = attendances.filter(a => {
    if (a.employeeId.toLowerCase() !== empId.toLowerCase()) return false;
    if (a.type && a.type !== "IN") return false;
    const d = new Date(a.timestamp);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const presentDaysSet = new Set();
  empAtts.forEach(a => {
    const d = new Date(a.timestamp);
    presentDaysSet.add(d.getDate());
  });
  const presentDays = presentDaysSet.size;

  const empLeaves = leaveRequests.filter(l => {
    if (l.employeeId.toLowerCase() !== empId.toLowerCase()) return false;
    if (l.status !== "APPROVED") return false;
    const d = new Date(l.dateTimestamp);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const leaveDaysSet = new Set();
  empLeaves.forEach(l => {
    const d = new Date(l.dateTimestamp);
    leaveDaysSet.add(d.getDate());
  });
  const approvedLeaveDays = leaveDaysSet.size;

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

// 3. Render Admin Dashboard Screen (Matches Android AdminDashboardScreen.kt)
function renderAdminDashboard() {
  if (!isAdmin) return;

  const staffListEl = document.getElementById("admin-staff-list");
  if (!staffListEl) return;

  const allEmps = Array.from(new Set([
    ...employeeSettingsList.map(s => s.employeeId.toLowerCase()),
    ...attendances.map(a => a.employeeId.toLowerCase())
  ])).filter(e => e !== "admin");

  if (allEmps.length === 0) {
    staffListEl.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 24px;">No registered employees found.</div>`;
    return;
  }

  staffListEl.innerHTML = allEmps.map(empId => {
    const s = getMySettings(empId);
    const displayName = (s.displayName && s.displayName.trim().length > 0) ? s.displayName.trim() : empId;
    const initial = (empId.charAt(0) || "?").toUpperCase();
    const photo = s.profilePhotoUri || "";

    return `
      <div class="emp-card-row" data-id="${empId}" style="background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; display: flex; align-items: center; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        ${photo ?
          `<img src="${photo}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; margin-right: 16px; flex-shrink: 0;" alt="Avatar">` :
          `<div style="width: 50px; height: 50px; border-radius: 50%; background: #49454F; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.2rem; margin-right: 16px; flex-shrink: 0;">${initial}</div>`
        }
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayName}</div>
          ${s.displayName && s.displayName.trim().length > 0 ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${empId}</div>` : ''}
        </div>
        <div style="color: var(--text-secondary); font-size: 1.2rem; padding-left: 8px;">›</div>
      </div>
    `;
  }).join("");

  staffListEl.querySelectorAll(".emp-card-row").forEach(el => {
    el.addEventListener("click", () => {
      openAdminEmployeeDetail(el.getAttribute("data-id"));
    });
  });
}

// 4. Admin Employee Detail / Settings Screen (Matches Android AdminEmployeeSettingsScreen.kt)
function openAdminEmployeeDetail(employeeId) {
  const s = getMySettings(employeeId);
  const titleEl = document.getElementById("admin-detail-title");
  if (titleEl) titleEl.textContent = `Settings: ${employeeId}`;

  document.getElementById("admin-detail-emp-id").value = employeeId;
  document.getElementById("admin-detail-display-name").value = s.displayName || "";
  document.getElementById("admin-detail-base-salary").value = s.baseSalary || 30000;
  document.getElementById("admin-detail-in-hour").value = s.checkInTimeHours ?? 9;
  document.getElementById("admin-detail-in-min").value = s.checkInTimeMinutes ?? 0;
  document.getElementById("admin-detail-out-hour").value = s.checkOutTimeHours ?? 17;
  document.getElementById("admin-detail-out-min").value = s.checkOutTimeMinutes ?? 0;

  // Calendar: Sunday=1, Monday=2, Tuesday=3, Wednesday=4, Thursday=5, Friday=6, Saturday=7
  const offs = s.weekOffs || [1, 7];
  for (let i = 1; i <= 7; i++) {
    const chk = document.getElementById(`chk-off-${i}`);
    if (chk) chk.checked = offs.includes(i);
  }

  document.getElementById("admin-detail-lat").value = s.targetLatitude || 0;
  document.getElementById("admin-detail-lon").value = s.targetLongitude || 0;
  document.getElementById("admin-detail-radius").value = s.targetRadiusMeters || 100;

  showView(viewAdminDetail);
}

const btnAdminDetailFillGps = document.getElementById("btn-admin-detail-fill-gps");
if (btnAdminDetailFillGps) {
  btnAdminDetailFillGps.addEventListener("click", () => {
    if (currentGpsLocation) {
      document.getElementById("admin-detail-lat").value = currentGpsLocation.lat.toFixed(6);
      document.getElementById("admin-detail-lon").value = currentGpsLocation.lon.toFixed(6);
      alert("GPS location acquired!");
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          document.getElementById("admin-detail-lat").value = pos.coords.latitude.toFixed(6);
          document.getElementById("admin-detail-lon").value = pos.coords.longitude.toFixed(6);
          alert("GPS location acquired!");
        },
        (err) => alert("Could not fetch location: " + err.message),
        { enableHighAccuracy: true }
      );
    } else {
      alert("Location not supported on this browser.");
    }
  });
}

const formAdminEmployeeDetail = document.getElementById("form-admin-employee-detail");
if (formAdminEmployeeDetail) {
  formAdminEmployeeDetail.addEventListener("submit", async (e) => {
    e.preventDefault();
    const empId = document.getElementById("admin-detail-emp-id").value;
    const offs = [];
    for (let i = 1; i <= 7; i++) {
      const chk = document.getElementById(`chk-off-${i}`);
      if (chk && chk.checked) offs.push(i);
    }

    const payload = {
      employeeId: empId.toLowerCase(),
      displayName: document.getElementById("admin-detail-display-name").value.trim(),
      baseSalary: parseFloat(document.getElementById("admin-detail-base-salary").value) || 30000,
      checkInTimeHours: parseInt(document.getElementById("admin-detail-in-hour").value) || 9,
      checkInTimeMinutes: parseInt(document.getElementById("admin-detail-in-min").value) || 0,
      checkOutTimeHours: parseInt(document.getElementById("admin-detail-out-hour").value) || 17,
      checkOutTimeMinutes: parseInt(document.getElementById("admin-detail-out-min").value) || 0,
      weekOffs: offs,
      targetLatitude: parseFloat(document.getElementById("admin-detail-lat").value) || 0,
      targetLongitude: parseFloat(document.getElementById("admin-detail-lon").value) || 0,
      targetRadiusMeters: parseFloat(document.getElementById("admin-detail-radius").value) || 100
    };

    try {
      const db = getDb();
      await setDoc(doc(db, "settings", empId.toLowerCase()), payload, { merge: true });
      alert("Settings saved successfully!");
      showView(viewAdmin);
      renderAdminDashboard();
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    }
  });
}

// 5. Manage Leave Requests Screen (Matches Android ManageLeavesScreen.kt)
function renderAdminLeavesList() {
  const leavesListEl = document.getElementById("admin-leaves-list");
  if (!leavesListEl) return;

  if (leaveRequests.length === 0) {
    leavesListEl.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 24px;">No leave requests found.</div>`;
    return;
  }

  leavesListEl.innerHTML = leaveRequests.map(req => {
    const s = getMySettings(req.employeeId);
    const empName = (s.displayName && s.displayName.trim().length > 0) ? s.displayName.trim() : req.employeeId;
    const dateStr = new Date(req.dateTimestamp).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
    const isPending = req.status === "PENDING";
    const statusColor = req.status === "APPROVED" ? "#2E7D32" : (req.status === "REJECTED" ? "#C62828" : "#E65100");

    return `
      <div style="background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <div style="font-size: 1rem; font-weight: 600; color: var(--primary); margin-bottom: 4px;">Employee: ${empName}</div>
        <div style="font-size: 0.95rem; margin-bottom: 4px; color: var(--text-primary);">Date: ${dateStr}</div>
        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 12px;">Reason: ${req.reason || "N/A"}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="font-weight: 600; font-size: 0.9rem;">Status: <span style="color: ${statusColor}; font-weight: 700;">${req.status}</span></div>
          ${isPending ? `
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn-m3 btn-approve-leave" data-id="${req.id}" style="height: 38px; padding: 0 16px; margin-bottom: 0; background: var(--primary);">Approve</button>
              <button type="button" class="btn-text btn-reject-leave" data-id="${req.id}" style="height: 38px; padding: 0 16px; border: 1.5px solid #D32F2F; color: #D32F2F; border-radius: 8px; font-weight: 600;">Reject</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");

  leavesListEl.querySelectorAll(".btn-approve-leave").forEach(btn => {
    btn.addEventListener("click", () => updateLeaveStatus(btn.getAttribute("data-id"), "APPROVED"));
  });
  leavesListEl.querySelectorAll(".btn-reject-leave").forEach(btn => {
    btn.addEventListener("click", () => updateLeaveStatus(btn.getAttribute("data-id"), "REJECTED"));
  });
}

async function updateLeaveStatus(id, newStatus) {
  try {
    const db = getDb();
    await updateDoc(doc(db, "leaveRequests", id), { status: newStatus });
    refreshAdminViews();
  } catch (err) {
    try {
      const fallbackDb = fallbackToDefaultDb();
      await updateDoc(doc(fallbackDb, "leaveRequests", id), { status: newStatus });
      refreshAdminViews();
    } catch (e) {
      alert("Failed to update leave status: " + e.message);
    }
  }
}

// 6. Monthly Report Screen (Matches Android MonthlyReportScreen.kt)
function renderMonthlyReportScreen() {
  const cardsContainer = document.getElementById("admin-monthly-report-cards");
  const monthYearLabel = document.getElementById("disp-report-month-year");
  if (!cardsContainer) return;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (monthYearLabel) {
    monthYearLabel.textContent = `${monthNames[reportSelectedMonth]} ${reportSelectedYear}`;
  }

  const allEmps = Array.from(new Set([
    ...employeeSettingsList.map(s => s.employeeId.toLowerCase()),
    ...attendances.map(a => a.employeeId.toLowerCase())
  ])).filter(e => e !== "admin");

  if (allEmps.length === 0) {
    cardsContainer.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 24px;">No employees found.</div>`;
    return;
  }

  cardsContainer.innerHTML = allEmps.map(empId => {
    const s = getMySettings(empId);
    const name = (s.displayName && s.displayName.trim().length > 0) ? s.displayName.trim() : empId;
    const calc = calculateSalaryForEmployee(empId, reportSelectedYear, reportSelectedMonth);

    return `
      <div style="background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <div style="font-size: 1.05rem; font-weight: 600; color: var(--text-primary);">${name}</div>
        <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px;">${empId}</div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.9rem;">
          <span style="color: var(--text-secondary);">Base Salary:</span>
          <span style="font-weight: 600;">₹${calc.baseSalary.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.9rem;">
          <span style="color: var(--text-secondary);">Total Working Days:</span>
          <span>${calc.totalWorkingDays}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.9rem;">
          <span style="color: var(--text-secondary);">Days Present:</span>
          <span>${calc.presentDays}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.9rem;">
          <span style="color: var(--text-secondary);">Approved Leaves:</span>
          <span>${calc.approvedLeaveDays}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.9rem;">
          <span style="color: var(--text-secondary);">Days Absent:</span>
          <span>${calc.absentDays}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.9rem;">
          <span style="color: var(--text-secondary);">Per Day Salary:</span>
          <span>₹${calc.perDaySalary.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.9rem; color: #D32F2F;">
          <span>Deduction:</span>
          <span style="font-weight: 600;">- ₹${calc.deduction.toFixed(2)}</span>
        </div>
        <div style="border-top: 1px solid #EEEEEE; margin: 10px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 1rem; font-weight: 700;">
          <span>Net Salary:</span>
          <span style="color: var(--primary);">₹${calc.netSalary.toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join("");
}

// Export CSV for the selected month/year in Monthly Report
const btnAdminExportReportCsv = document.getElementById("btn-admin-export-csv");
if (btnAdminExportReportCsv) {
  btnAdminExportReportCsv.addEventListener("click", () => {
    const allEmps = Array.from(new Set([
      ...employeeSettingsList.map(s => s.employeeId.toLowerCase()),
      ...attendances.map(a => a.employeeId.toLowerCase())
    ])).filter(e => e !== "admin");

    let csv = "Employee Name,Base Salary,Total Working Days,Days Present,Approved Leaves,Days Absent,Per Day Salary,Deduction,Net Salary\n";
    allEmps.forEach(empId => {
      const s = getMySettings(empId);
      const name = (s.displayName && s.displayName.trim().length > 0) ? s.displayName.trim() : empId;
      const calc = calculateSalaryForEmployee(empId, reportSelectedYear, reportSelectedMonth);
      csv += `"${name}",${calc.baseSalary},${calc.totalWorkingDays},${calc.presentDays},${calc.approvedLeaveDays},${calc.absentDays},${calc.perDaySalary.toFixed(2)},${calc.deduction.toFixed(2)},${calc.netSalary.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `monthly_report_${reportSelectedYear}_${reportSelectedMonth + 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration error:', err));
  });
}

