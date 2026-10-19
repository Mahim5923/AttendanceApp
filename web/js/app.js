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

const allViews = [viewLogin, viewMain, viewHistory, viewLeave, viewSalary, viewChat, viewProfile, viewAdmin];

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
      renderAdminDashboard();
    }, (err) => handleListenerError(err, "settings"));

    // 2. Attendances listener
    const attendancesCol = collection(db, "attendances");
    const attQuery = isAdmin ? attendancesCol : query(attendancesCol, where("employeeId", "==", email));
    unsubAttendances = onSnapshot(attQuery, (snap) => {
      attendances = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      renderAttendanceCalendar();
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

// --- Admin Employee Settings Modal ---
const modalAdminSettings = document.getElementById("modal-admin-settings");
const btnCloseSettingsModal = document.getElementById("btn-close-settings-modal");
if (btnCloseSettingsModal) {
  btnCloseSettingsModal.addEventListener("click", () => {
    if (modalAdminSettings) modalAdminSettings.classList.remove("open");
  });
}

function openAdminSettingsModal(employeeId) {
  const s = getMySettings(employeeId);
  document.getElementById("set-emp-id").value = employeeId;
  document.getElementById("set-emp-name").value = s.displayName || employeeId.split("@")[0];
  document.getElementById("set-emp-salary").value = s.baseSalary || 30000;
  document.getElementById("set-in-hour").value = s.checkInTimeHours ?? 9;
  document.getElementById("set-in-min").value = s.checkInTimeMinutes ?? 0;
  document.getElementById("set-out-hour").value = s.checkOutTimeHours ?? 17;
  document.getElementById("set-out-min").value = s.checkOutTimeMinutes ?? 0;

  const offs = s.weekOffs || [1, 7];
  for (let i = 1; i <= 7; i++) {
    const chk = document.getElementById(`chk-off-${i}`);
    if (chk) chk.checked = offs.includes(i);
  }

  document.getElementById("set-lat").value = s.targetLatitude || 0;
  document.getElementById("set-lon").value = s.targetLongitude || 0;
  document.getElementById("set-radius").value = s.targetRadiusMeters || 100;

  if (modalAdminSettings) modalAdminSettings.classList.add("open");
}

const btnSetCurrentGps = document.getElementById("btn-set-current-gps");
if (btnSetCurrentGps) {
  btnSetCurrentGps.addEventListener("click", () => {
    if (currentGpsLocation) {
      document.getElementById("set-lat").value = currentGpsLocation.lat.toFixed(6);
      document.getElementById("set-lon").value = currentGpsLocation.lon.toFixed(6);
      alert("GPS location acquired!");
    } else {
      alert("Location not yet acquired. Please allow GPS access.");
    }
  });
}

const formAdminSettings = document.getElementById("form-admin-settings");
if (formAdminSettings) {
  formAdminSettings.addEventListener("submit", async (e) => {
    e.preventDefault();
    const empId = document.getElementById("set-emp-id").value;
    const offs = [];
    for (let i = 1; i <= 7; i++) {
      const chk = document.getElementById(`chk-off-${i}`);
      if (chk && chk.checked) offs.push(i);
    }

    const payload = {
      employeeId: empId.toLowerCase(),
      displayName: document.getElementById("set-emp-name").value.trim(),
      baseSalary: parseFloat(document.getElementById("set-emp-salary").value) || 30000,
      checkInTimeHours: parseInt(document.getElementById("set-in-hour").value) || 9,
      checkInTimeMinutes: parseInt(document.getElementById("set-in-min").value) || 0,
      checkOutTimeHours: parseInt(document.getElementById("set-out-hour").value) || 17,
      checkOutTimeMinutes: parseInt(document.getElementById("set-out-min").value) || 0,
      weekOffs: offs,
      targetLatitude: parseFloat(document.getElementById("set-lat").value) || 0,
      targetLongitude: parseFloat(document.getElementById("set-lon").value) || 0,
      targetRadiusMeters: parseFloat(document.getElementById("set-radius").value) || 100
    };

    try {
      const db = getDb();
      await setDoc(doc(db, "settings", empId.toLowerCase()), payload, { merge: true });
      alert("Settings saved successfully!");
      if (modalAdminSettings) modalAdminSettings.classList.remove("open");
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    }
  });
}

// --- Admin Dashboard View ---
const tabBtnEmployees = document.getElementById("tab-btn-employees");
const tabBtnLeaves = document.getElementById("tab-btn-leaves");
const adminStaffSection = document.getElementById("admin-employees-section");
const adminLeavesSection = document.getElementById("admin-leaves-section");

if (tabBtnEmployees && tabBtnLeaves) {
  tabBtnEmployees.addEventListener("click", () => {
    tabBtnEmployees.classList.remove("btn-m3-secondary");
    tabBtnLeaves.classList.add("btn-m3-secondary");
    if (adminStaffSection) adminStaffSection.style.display = "block";
    if (adminLeavesSection) adminLeavesSection.style.display = "none";
  });

  tabBtnLeaves.addEventListener("click", () => {
    tabBtnLeaves.classList.remove("btn-m3-secondary");
    tabBtnEmployees.classList.add("btn-m3-secondary");
    if (adminStaffSection) adminStaffSection.style.display = "none";
    if (adminLeavesSection) adminLeavesSection.style.display = "block";
  });
}

function renderAdminDashboard() {
  if (!isAdmin) return;

  const staffListEl = document.getElementById("admin-staff-list");
  const leavesListEl = document.getElementById("admin-leaves-list");
  const pendingCountEl = document.getElementById("admin-pending-leaves-count");

  const pending = leaveRequests.filter(l => l.status === "PENDING");
  if (pendingCountEl) pendingCountEl.textContent = pending.length;

  const allEmps = Array.from(new Set([
    ...employeeSettingsList.map(s => s.employeeId.toLowerCase()),
    ...attendances.map(a => a.employeeId.toLowerCase())
  ])).filter(e => e !== "admin");

  // Render staff
  if (staffListEl) {
    if (allEmps.length === 0) {
      staffListEl.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 20px;">No registered employees found.</div>`;
    } else {
      staffListEl.innerHTML = allEmps.map(empId => {
        const s = getMySettings(empId);
        const name = s.displayName || empId.split("@")[0];
        return `
          <div style="background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <div style="cursor: pointer;" class="emp-row-info" data-id="${empId}">
              <div style="font-weight: 600; font-size: 1rem;">${name}</div>
              <div style="font-size: 0.82rem; color: var(--text-secondary);">${empId}</div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn-text btn-admin-chat-staff" data-id="${empId}" style="font-size: 0.85rem; padding: 6px 10px;">Chat</button>
              <button type="button" class="btn-text btn-admin-edit-staff" data-id="${empId}" style="font-size: 0.85rem; padding: 6px 10px;">⚙️</button>
            </div>
          </div>
        `;
      }).join("");

      staffListEl.querySelectorAll(".btn-admin-edit-staff, .emp-row-info").forEach(el => {
        el.addEventListener("click", () => {
          openAdminSettingsModal(el.getAttribute("data-id"));
        });
      });

      staffListEl.querySelectorAll(".btn-admin-chat-staff").forEach(btn => {
        btn.addEventListener("click", () => {
          activeChatPartner = btn.getAttribute("data-id");
          const title = document.getElementById("chat-title");
          if (title) title.textContent = `Chat with ${activeChatPartner.split("@")[0]}`;
          showView(viewChat);
          renderChatMessages();
        });
      });
    }
  }

  // Render pending leaves
  if (leavesListEl) {
    if (pending.length === 0) {
      leavesListEl.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 20px;">No pending leave requests.</div>`;
    } else {
      leavesListEl.innerHTML = pending.map(l => {
        const dt = new Date(l.dateTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        return `
          <div style="background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 12px; padding: 14px; margin-bottom: 12px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${l.employeeId}</div>
            <div style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 8px;">Date: ${dt} • "${l.reason}"</div>
            <div style="display: flex; gap: 10px;">
              <button type="button" class="btn-m3 btn-approve-leave" data-id="${l.id}" style="height: 38px; margin-bottom: 0; flex: 1; background: #2E7D32;">Approve</button>
              <button type="button" class="btn-m3 btn-reject-leave" data-id="${l.id}" style="height: 38px; margin-bottom: 0; flex: 1; background: #E53935;">Reject</button>
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
  }
}

async function updateLeaveStatus(id, newStatus) {
  try {
    const db = getDb();
    await updateDoc(doc(db, "leaveRequests", id), { status: newStatus });
  } catch (err) {
    const fallbackDb = fallbackToDefaultDb();
    await updateDoc(doc(fallbackDb, "leaveRequests", id), { status: newStatus });
  }
}

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration error:', err));
  });
}
