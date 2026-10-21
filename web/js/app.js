// AttendPro - Modern Web & Mobile App Controller
// 100% Matches Android Material 3 UI & Exact Feature Working
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
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs
} from "./firebase-config.js?v=2.1";
import { dictionary } from "./i18n.js";

// --- Language Helper ---
function t(text) {
  if (isHindi && dictionary && dictionary[text]) {
    return dictionary[text];
  }
  return text;
}

// --- State Variables ---
let currentUser = null;
let isAdmin = false;
let isHindi = false;

let attendances = [];
let employeeSettingsList = [];
let leaveRequests = [];
let chatMessages = [];
let activeChatPartner = null;

let currentGpsLocation = null;
let clockActionType = "IN";
let capturedPhotoBase64 = null;
let mediaStream = null;

// ---------- Admin e‑mail handling ----------
const DEFAULT_ADMIN_EMAILS = [
  "mahimsinhsingoria@gmail.com",
  "nkjainnilesh@gmail.com"
];

/** Holds all admin e‑mail addresses fetched from Firestore plus defaults. */
let adminEmails = [...DEFAULT_ADMIN_EMAILS];

/**
 * Loads the admin e‑mail list from the Firestore collection `admins`.
 * The collection should contain documents with a field `email` (string).
 */
async function loadAdminEmails() {
  try {
    const adminCol = collection(getDb(), "admins");
    const snapshot = await getDocs(adminCol);
    const fetched = snapshot.docs
      .map((d) => d.data().email?.toLowerCase())
      .filter(Boolean);
    adminEmails = Array.from(new Set([...DEFAULT_ADMIN_EMAILS, ...fetched]));
  } catch (e) {
    console.warn("Failed to load admin e-mails:", e);
    adminEmails = [...DEFAULT_ADMIN_EMAILS];
  }
}

// Calendar State
let calendarDate = new Date();
let selectedCalendarDate = new Date();

// Branch State
let branchesList = [];
let unsubBranches = null;
let adminSelectedBranchFilter = "ALL";
let adminSelectedLeavesBranchFilter = "ALL";
let adminSelectedReportBranchFilter = "ALL";
let editingBranchId = null;
let branchMap = null;
let branchMapMarker = null;
let branchMapCircle = null;

// Firestore real-time listener unsubs
let unsubAttendances = null;
let unsubSettings = null;
let unsubLeaves = null;
let unsubMessages = null;

// --- Language Dictionary imported from i18n.js (see js/i18n.js) ---

function showSpinner() {
  const overlay = document.getElementById('spinner-overlay');
  if (overlay) overlay.style.display = 'flex';
}

function hideSpinner() {
  const overlay = document.getElementById('spinner-overlay');
  if (overlay) overlay.style.display = 'none';
}

let pendingListeners = 0;
const TOTAL_FIRESTORE_LISTENERS = 5;
function listenerResolved() {
  pendingListeners--;
  if (pendingListeners <= 0) hideSpinner();
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
const viewAdminBranches = document.getElementById("view-admin-branches");

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
  viewAdminDetail,
  viewAdminBranches
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
  const raw = employeeSettingsList.find(s => (s.employeeId || "").toLowerCase() === email) || {
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
    weekOffs: [1, 7], // 1 = Sun, 7 = Sat matching Java Calendar
    branch: ""
  };

  // If assigned to a branch, inherit shift times and geofence location from the branch!
  // Note: weekOffs, baseSalary, and displayName remain individual to the employee!
  if (raw.branch) {
    const branch = branchesList.find(b =>
      (b.name && b.name.toLowerCase() === raw.branch.toLowerCase()) ||
      (b.id && b.id.toLowerCase() === raw.branch.toLowerCase())
    );
    if (branch) {
      return {
        ...raw,
        branch: branch.name || raw.branch,
        checkInTimeHours: branch.checkInTimeHours ?? raw.checkInTimeHours ?? 9,
        checkInTimeMinutes: branch.checkInTimeMinutes ?? raw.checkInTimeMinutes ?? 0,
        checkOutTimeHours: branch.checkOutTimeHours ?? raw.checkOutTimeHours ?? 17,
        checkOutTimeMinutes: branch.checkOutTimeMinutes ?? raw.checkOutTimeMinutes ?? 0,
        targetLatitude: branch.targetLatitude !== undefined ? branch.targetLatitude : (raw.targetLatitude ?? 0),
        targetLongitude: branch.targetLongitude !== undefined ? branch.targetLongitude : (raw.targetLongitude ?? 0),
        targetRadiusMeters: branch.targetRadiusMeters !== undefined ? branch.targetRadiusMeters : (raw.targetRadiusMeters ?? 100),
        weekOffs: raw.weekOffs || [1, 7] // Individual week offs preserved!
      };
    }
  }

  return raw;
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
    txtLoginBtn.textContent = isHindi ? "लॉग इन करें" : "Login";
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
  welcomeEl.textContent = isHindi ? `à¤¸à¥à¤µà¤¾à¤—à¤¤ à¤¹à¥ˆ, ${name}` : `Welcome, ${name}`;
}

function hideAuthBanners() {
  const errBanner = document.getElementById("login-error-banner");
  if (errBanner) {
    errBanner.style.display = "none";
    errBanner.innerHTML = "";
  }
}

function showAuthError(message) {
  const errBanner = document.getElementById("login-error-banner");
  if (!errBanner) return;
  errBanner.style.display = "block";
  errBanner.textContent = message;
}

// --- Robust Login Handler (Never reloads page, preserves input values) ---
async function performLogin() {
  const emailInput = document.getElementById("login-email");
  const passInput = document.getElementById("login-password");
  const rawInput = (emailInput?.value || "").trim();
  const pass = (passInput?.value || "");
  console.log('Login attempt with email:', rawInput, 'password length:', pass.length);
  const btn = document.getElementById("btn-login-submit");
  const txtBtn = document.getElementById("txt-login-btn");

  if (!rawInput || !pass) {
    showAuthError(isHindi ? "कृपया ईमेल और पासवर्ड दोनों दर्ज करें।" : "Please enter both email and password.");
    return;
  }

  // Resolve usernames to accounts
  let targetEmail = rawInput;
  const lowerInput = rawInput.toLowerCase();
  // Resolve shortcuts or admin emails
  if (lowerInput === "admin") {
    targetEmail = "mahimsinhsingoria@gmail.com";
  } else if (lowerInput === "nilesh" || lowerInput === "nknilesh") {
    targetEmail = "nkjainnilesh@gmail.com";
  }

  if (!targetEmail.includes("@")) {
    showAuthError(isHindi ? "कृपया एक मान्य ईमेल दर्ज करें या 'admin' का उपयोग करें।" : "Please enter a valid email address (e.g. name@example.com) or 'admin'.");
    return;
  }

  hideAuthBanners();
  if (btn) btn.disabled = true;
  if (txtBtn) txtBtn.textContent = isHindi ? "सत्यापित हो रहा है..." : "Authenticating...";

  try {
    // 1. Attempt standard Firebase Auth sign-in
    await signInWithEmailAndPassword(auth, targetEmail, pass);
    console.log('Login successful for', targetEmail);
  } catch (err) {
    console.error("Sign-in error:", err);
    const errCode = err.code || "";
    const errMsg = err.message || "";

    const isCredentialError =
      errCode === "auth/invalid-credential" ||
      errCode === "auth/user-not-found" ||
      errMsg.includes("INVALID_LOGIN_CREDENTIALS");

    // Handle specific error codes - refuse access if account does not exist or credentials fail
    let msg = errMsg || (isHindi ? "लॉगिन विफल रहा।" : "Login failed.");
    if (errCode === "auth/user-not-found") {
      msg = isHindi
        ? "खाता मौजूद नहीं है। पहुँच अस्वीकृत। कृपया व्यवस्थापक से संपर्क करें।"
        : "Account does not exist. Access denied. Please contact your administrator.";
    } else if (errCode === "auth/wrong-password") {
      msg = isHindi ? "गलत पासवर्ड। कृपया पुनः प्रयास करें।" : "Incorrect password. Please try again.";
    } else if (isCredentialError) {
      const emailLower = targetEmail.toLowerCase();
      if (emailLower === "mahimsinhsingoria@gmail.com" || emailLower === "nkjainnilesh@gmail.com") {
        msg = isHindi ? "एडमिन पासवर्ड गलत है। कृपया पुनः प्रयास करें।" : "Incorrect admin password. Please try again.";
      } else {
        msg = isHindi
          ? "खाता मौजूद नहीं है या अमान्य विवरण। पहुँच अस्वीकृत। कृपया व्यवस्थापक से संपर्क करें।"
          : "Account does not exist or invalid credentials. Access denied. Please contact your administrator.";
      }
    } else if (errCode === "auth/invalid-email") {
      msg = isHindi ? "अमान्य ईमेल पता।" : "Invalid email format. Please check your email.";
    } else if (errCode === "auth/network-request-failed") {
      msg = isHindi ? "नेटवर्क त्रुटि। कृपया इंटरनेट कनेक्शन जांचें।" : "Network error. Please check your internet connection.";
    } else if (errCode === "auth/too-many-requests") {
      msg = isHindi ? "बहुत सारे असफल प्रयास। कृपया थोड़ी देर बाद पुनः प्रयास करें।" : "Access temporarily disabled due to many failed attempts. Try again later.";
    } else if (errCode === "auth/user-disabled") {
      msg = isHindi ? "यह खाता अक्षम कर दिया गया है।" : "This account has been disabled.";
      } else if (errCode === "auth/unauthorized-domain") {
        msg = isHindi ? "अनधिकृत डोमेन। कृपया Firebase कंसोल में डोमेन जोड़ें।" : "Unauthorized domain. Please add the site domain in Firebase console.";
    }

    showAuthError(msg);
  } finally {
    if (btn) btn.disabled = false;
    applyTranslations();
  }
}

// Expose on window for direct access
window.triggerLogin = performLogin;

// Bind both button click and form submit listeners
// Button click handler removed; form submit listener (above) handles login

const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    console.log('Login form submitted');
    e.preventDefault();
    performLogin();
  });
}

// Bind Enter key in inputs
const loginPasswordInput = document.getElementById("login-password");
if (loginPasswordInput) {
  loginPasswordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      performLogin();
    }
  });
}

const loginEmailInput = document.getElementById("login-email");
if (loginEmailInput) {
  loginEmailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      loginPasswordInput?.focus();
    }
  });
}

// --- Auth State Observer ---
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    const userEmail = (user.email || "").toLowerCase();
    // Load admin emails from Firestore
    await loadAdminEmails();
    isAdmin = adminEmails.includes(userEmail) || DEFAULT_ADMIN_EMAILS.includes(userEmail);
    console.log('Admin emails loaded, isAdmin:', isAdmin);
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
  if (unsubBranches) unsubBranches();
}

function setupFirestoreListeners(email) {
  detachListeners();
  let db = getDb();
pendingListeners = TOTAL_FIRESTORE_LISTENERS;
showSpinner();

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
    listenerResolved();
      employeeSettingsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateWelcomeText();
      refreshAdminViews();
    }, (err) => handleListenerError(err, "settings"));

    // 2. Attendances listener
    const attendancesCol = collection(db, "attendances");
    const attQuery = isAdmin ? attendancesCol : query(attendancesCol, where("employeeId", "==", email));
    unsubAttendances = onSnapshot(attQuery, (snap) => {
    listenerResolved();
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
    listenerResolved();
      leaveRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.requestedAtTimestamp || 0) - (a.requestedAtTimestamp || 0));
      renderLeaveRequests();
      refreshAdminViews();
    }, (err) => handleListenerError(err, "leaveRequests"));

    // 4. Messages listener
    const messagesCol = collection(db, "messages");
    unsubMessages = onSnapshot(messagesCol, (snap) => {
    listenerResolved();
      chatMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      renderChatMessages();
    }, (err) => handleListenerError(err, "messages"));

    // 5. Branches listener (Realtime updates for all branches)
    const branchesCol = collection(db, "branches");
    unsubBranches = onSnapshot(branchesCol, (snap) => {
    listenerResolved();
      branchesList = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      renderAdminBranchesList();
      refreshAdminViews();
    }, (err) => handleListenerError(err, "branches"));

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
  today.setHours(0, 0, 0, 0);

  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month, day);
    const dayOfWeek = d.getDay() + 1; // 1 = Sun, 7 = Sat

    let dotColor = "transparent";
    const isWeekOff = weekOffs.includes(dayOfWeek);
    const dayAtts = userAtts.filter(a => {
      const ad = new Date(a.timestamp);
      return ad.getFullYear() === year && ad.getMonth() === month && ad.getDate() === day;
    });
    const hasIn = dayAtts.some(a => (a.type || "").toUpperCase().trim() === "IN");
    const hasOut = dayAtts.some(a => (a.type || "").toUpperCase().trim() === "OUT");
    const isPresent = hasIn && hasOut;

    const hasLeave = userLeaves.some(l => {
      const ld = new Date(l.dateTimestamp);
      return ld.getFullYear() === year && ld.getMonth() === month && ld.getDate() === day;
    });

    if (isWeekOff) {
      dotColor = "#9E9E9E"; // Week off
    } else if (hasLeave) {
      dotColor = "#FB8C00"; // Leave
    } else if (isPresent) {
      dotColor = "#2E7D32"; // Present (both IN and OUT completed)
    } else if (d <= today) {
      dotColor = "#E53935"; // Absent (only marked present if both IN and OUT are done)
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
    const photo = a.photoUri ? `<img src="${a.photoUri}" class="history-thumb" alt="Selfie">` : `<div class="history-thumb" style="display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:600;color:var(--text-secondary);">No Pic</div>`;

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

  // Only count a day as PRESENT if the employee marked BOTH IN and OUT on that date
  const dayPunches = {};
  attendances.forEach(a => {
    if (currentUser && a.employeeId.toLowerCase() !== currentUser.email.toLowerCase()) return;
    const d = new Date(a.timestamp);
    if (d.getFullYear() === year && d.getMonth() === monthIndex) {
      const day = d.getDate();
      if (!dayPunches[day]) dayPunches[day] = { hasIn: false, hasOut: false };
      const typeUpper = (a.type || "").toUpperCase().trim();
      if (typeUpper === "IN") dayPunches[day].hasIn = true;
      if (typeUpper === "OUT") dayPunches[day].hasOut = true;
    }
  });

  let daysPresent = 0;
  for (const day in dayPunches) {
    if (dayPunches[day].hasIn && dayPunches[day].hasOut) {
      daysPresent++;
    }
  }

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
    exportSalaryReportCsv();
  });
}

function exportSalaryReportCsv() {
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

    // Only count as present if BOTH IN and OUT were marked
    const dayPunches = {};
    attendances.forEach(a => {
      if (a.employeeId.toLowerCase() !== empId) return;
      const d = new Date(a.timestamp);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!dayPunches[day]) dayPunches[day] = { hasIn: false, hasOut: false };
        const typeUpper = (a.type || "").toUpperCase().trim();
        if (typeUpper === "IN") dayPunches[day].hasIn = true;
        if (typeUpper === "OUT") dayPunches[day].hasOut = true;
      }
    });

    let presentDays = 0;
    for (const day in dayPunches) {
      if (dayPunches[day].hasIn && dayPunches[day].hasOut) {
        presentDays++;
      }
    }

    const approvedLeaves = leaveRequests.filter(l => {
      if (l.employeeId.toLowerCase() !== empId || l.status !== "APPROVED") return false;
      const d = new Date(l.dateTimestamp);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;

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
        return (m.senderId === activeChatPartner && (m.receiverId === currentEmail || m.receiverId === "admin")) ||
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

// Removed file input handling; camera UI handles profile photo capture

// Camera capture for profile photo
const btnStartCamera = document.getElementById('btn-start-camera');
const btnCapturePhotoProfile = document.getElementById('btn-capture-photo');
const videoStream = document.getElementById('camera-stream');
let mediaStream = null;
if (btnStartCamera && btnCapturePhotoProfile && videoStream) {
  btnStartCamera.addEventListener('click', async () => {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoStream.srcObject = mediaStream;
      videoStream.style.display = 'block';
      btnCapturePhotoProfile.style.display = 'inline-block';
      btnStartCamera.style.display = 'none';
    } catch (err) {
      alert('Camera access denied or unavailable.');
    }
  });
  btnCapturePhotoProfile.addEventListener('click', () => {
    if (!mediaStream) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoStream.videoWidth;
    canvas.height = videoStream.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoStream, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    const avatarPreview = document.getElementById('avatar-preview');
    if (avatarPreview) avatarPreview.src = dataUrl;
    // Stop the camera stream
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
    videoStream.style.display = 'none';
    btnCapturePhotoProfile.style.display = 'none';
    btnStartCamera.style.display = 'inline-block';
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
  if (viewAdminDetail && viewAdminDetail.classList.contains("active") && adminDetailEmployeeId) {
    renderAdminEmployeeCalendar();
    renderAdminEmployeeDateRecords();
  }
  if (viewAdminBranches && viewAdminBranches.classList.contains("active")) {
    renderAdminBranchesList();
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

const btnAdminToBranches = document.getElementById("btn-admin-to-branches");
if (btnAdminToBranches) {
  btnAdminToBranches.addEventListener("click", () => {
    showView(viewAdminBranches);
    renderAdminBranchesList();
  });
}

const btnBackFromAdminBranches = document.getElementById("btn-back-from-admin-branches");
if (btnBackFromAdminBranches) {
  btnBackFromAdminBranches.addEventListener("click", () => {
    showView(viewAdmin);
    renderAdminDashboard();
  });
}

const btnBackFromAdminDetail = document.getElementById("btn-back-from-admin-detail");
if (btnBackFromAdminDetail) {
  btnBackFromAdminDetail.addEventListener("click", () => {
    showView(viewAdmin);
  });
}

// Month Navigation for Monthly Report
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

  // Only count a day as PRESENT if the employee marked BOTH IN and OUT on that date
  const dayPunches = {};
  attendances.forEach(a => {
    if (a.employeeId.toLowerCase() !== empId.toLowerCase()) return;
    const d = new Date(a.timestamp);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!dayPunches[day]) dayPunches[day] = { hasIn: false, hasOut: false };
      const typeUpper = (a.type || "").toUpperCase().trim();
      if (typeUpper === "IN") dayPunches[day].hasIn = true;
      if (typeUpper === "OUT") dayPunches[day].hasOut = true;
    }
  });

  let presentDays = 0;
  for (const day in dayPunches) {
    if (dayPunches[day].hasIn && dayPunches[day].hasOut) {
      presentDays++;
    }
  }

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

  checkAndRenderEndOfMonthAlert();

  const staffListEl = document.getElementById("admin-staff-list");
  if (!staffListEl) return;

  const allEmps = Array.from(new Set([
    ...employeeSettingsList.map(s => s.employeeId.toLowerCase()),
    ...attendances.map(a => a.employeeId.toLowerCase())
  ])).filter(e => e !== "admin");

  // Render Branch Filter Tabs
  const branchFilterContainer = document.getElementById("admin-branch-filter-container");
  const staffCountEl = document.getElementById("admin-staff-count");
  if (branchFilterContainer) {
    const branchCounts = {};
    let unassignedCount = 0;
    allEmps.forEach(empId => {
      const s = getMySettings(empId);
      if (s.branch) {
        branchCounts[s.branch] = (branchCounts[s.branch] || 0) + 1;
      } else {
        unassignedCount++;
      }
    });

    let filterHtml = `
      <button type="button" class="btn-text branch-filter-pill ${adminSelectedBranchFilter === 'ALL' ? 'active-filter' : ''}" data-branch="ALL">
        All (${allEmps.length})
      </button>
    `;

    branchesList.forEach(b => {
      const count = branchCounts[b.name] || 0;
      const isAct = adminSelectedBranchFilter.toLowerCase() === (b.name || "").toLowerCase();
      filterHtml += `
        <button type="button" class="btn-text branch-filter-pill ${isAct ? 'active-filter' : ''}" data-branch="${b.name}">
          ${b.name} (${count})
        </button>
      `;
    });

    if (unassignedCount > 0 || branchesList.length > 0) {
      const isUnassignedAct = adminSelectedBranchFilter === 'UNASSIGNED';
      filterHtml += `
        <button type="button" class="btn-text branch-filter-pill ${isUnassignedAct ? 'active-filter' : ''}" data-branch="UNASSIGNED">
          Unassigned (${unassignedCount})
        </button>
      `;
    }

    branchFilterContainer.innerHTML = filterHtml;
    branchFilterContainer.querySelectorAll(".branch-filter-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        adminSelectedBranchFilter = pill.getAttribute("data-branch");
        renderAdminDashboard();
      });
    });
  }

  // Filter employees based on selected branch
  let filteredEmps = allEmps.slice();
  if (adminSelectedBranchFilter === "UNASSIGNED") {
    filteredEmps = allEmps.filter(empId => !getMySettings(empId).branch);
  } else if (adminSelectedBranchFilter !== "ALL") {
    filteredEmps = allEmps.filter(empId => (getMySettings(empId).branch || "").toLowerCase() === adminSelectedBranchFilter.toLowerCase());
  }

  // Sort employees by branch, then by name
  filteredEmps.sort((a, b) => {
    const brA = (getMySettings(a).branch || "ZZZ_NoBranch").toLowerCase();
    const brB = (getMySettings(b).branch || "ZZZ_NoBranch").toLowerCase();
    if (brA !== brB) return brA.localeCompare(brB);
    const nameA = (getMySettings(a).displayName || a).toLowerCase();
    const nameB = (getMySettings(b).displayName || b).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  if (staffCountEl) {
    staffCountEl.textContent = `${filteredEmps.length} ${filteredEmps.length === 1 ? 'employee' : 'employees'}`;
  }

  if (filteredEmps.length === 0) {
    staffListEl.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 32px 16px; background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 12px;">No employees in this branch.</div>`;
    return;
  }

  staffListEl.innerHTML = filteredEmps.map(empId => {
    const s = getMySettings(empId);
    const displayName = (s.displayName && s.displayName.trim().length > 0) ? s.displayName.trim() : empId;
    const initial = (empId.charAt(0) || "?").toUpperCase();
    const photo = s.profilePhotoUri || "";
    const branchName = s.branch || "Unassigned";

    return `
      <div class="emp-card-row" data-id="${empId}" style="background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; display: flex; align-items: center; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        ${photo ?
        `<img src="${photo}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; margin-right: 16px; flex-shrink: 0;" alt="Avatar">` :
        `<div style="width: 50px; height: 50px; border-radius: 50%; background: #49454F; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.2rem; margin-right: 16px; flex-shrink: 0;">${initial}</div>`
      }
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayName}</div>
          ${s.displayName && s.displayName.trim().length > 0 ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${empId}</div>` : ''}
          <div style="margin-top: 4px;">
            <span class="branch-badge ${s.branch ? '' : 'unassigned'}">${branchName}</span>
          </div>
        </div>
        <div style="color: var(--text-secondary); font-size: 1.2rem; padding-left: 8px;">&rsaquo;</div>
      </div>
    `;
  }).join("");

  staffListEl.querySelectorAll(".emp-card-row").forEach(el => {
    el.addEventListener("click", () => {
      openAdminEmployeeDetail(el.getAttribute("data-id"));
    });
  });
}

// 4. Admin Employee Detail & Attendance Screen (Matches Android AdminEmployeeDetailScreen.kt)
let adminDetailEmployeeId = null;
let adminEmpCalendarDate = new Date();
let adminEmpSelectedDate = new Date();

function openAdminEmployeeDetail(employeeId) {
  adminDetailEmployeeId = employeeId;
  adminEmpCalendarDate = new Date();
  adminEmpSelectedDate = new Date();

  const s = getMySettings(employeeId);
  const displayName = (s.displayName && s.displayName.trim().length > 0) ? s.displayName.trim() : employeeId;

  // Header Title
  const titleEl = document.getElementById("admin-detail-title");
  if (titleEl) titleEl.textContent = `Details: ${displayName}`;

  // Overview Info Card
  const dispBranch = document.getElementById("admin-detail-disp-branch");
  if (dispBranch) dispBranch.textContent = s.branch ? s.branch : "Unassigned (Custom Settings)";

  const dispSalary = document.getElementById("admin-detail-disp-salary");
  if (dispSalary) dispSalary.textContent = `₹${(s.baseSalary || 30000).toLocaleString()}`;

  const dispShift = document.getElementById("admin-detail-disp-shift");
  const inH = String(s.checkInTimeHours ?? 9).padStart(2, "0");
  const inM = String(s.checkInTimeMinutes ?? 0).padStart(2, "0");
  const outH = String(s.checkOutTimeHours ?? 17).padStart(2, "0");
  const outM = String(s.checkOutTimeMinutes ?? 0).padStart(2, "0");
  if (dispShift) dispShift.textContent = `${inH}:${inM} - ${outH}:${outM}`;

  const weekDays = { 1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday", 5: "Thursday", 6: "Friday", 7: "Saturday" };
  const offs = (s.weekOffs || [1, 7]).map(w => weekDays[w]).filter(Boolean).join(", ");
  const dispOffs = document.getElementById("admin-detail-disp-offs");
  if (dispOffs) dispOffs.textContent = offs.length > 0 ? offs : "None";

  // Pre-fill Edit Modal Fields
  document.getElementById("admin-detail-emp-id").value = employeeId;
  document.getElementById("admin-detail-display-name").value = s.displayName || "";
  document.getElementById("admin-detail-base-salary").value = s.baseSalary || 30000;

  // Populate Branch Select Dropdown
  const branchSelect = document.getElementById("admin-detail-branch");
  const branchHint = document.getElementById("admin-detail-branch-hint");
  if (branchSelect) {
    let branchOptions = `<option value="">-- No Branch (Individual Settings) --</option>`;
    branchesList.forEach(b => {
      const isSel = (s.branch || "").toLowerCase() === (b.name || "").toLowerCase();
      const bInH = String(b.checkInTimeHours ?? 9).padStart(2, "0");
      const bInM = String(b.checkInTimeMinutes ?? 0).padStart(2, "0");
      const bOutH = String(b.checkOutTimeHours ?? 17).padStart(2, "0");
      const bOutM = String(b.checkOutTimeMinutes ?? 0).padStart(2, "0");
      branchOptions += `<option value="${b.name}" ${isSel ? 'selected' : ''}>${b.name} (${bInH}:${bInM} - ${bOutH}:${bOutM})</option>`;
    });
    branchSelect.innerHTML = branchOptions;

    if (branchHint) {
      branchHint.style.display = s.branch ? "block" : "none";
    }

    // Auto-fill on branch change
    branchSelect.onchange = () => {
      const selectedName = branchSelect.value;
      if (selectedName) {
        const foundBranch = branchesList.find(b => b.name.toLowerCase() === selectedName.toLowerCase());
        if (foundBranch) {
          if (branchHint) {
            branchHint.textContent = `â„¹ï¸ Shift times (${String(foundBranch.checkInTimeHours).padStart(2, '0')}:${String(foundBranch.checkInTimeMinutes).padStart(2, '0')} - ${String(foundBranch.checkOutTimeHours).padStart(2, '0')}:${String(foundBranch.checkOutTimeMinutes).padStart(2, '0')}) and office location will be synced from ${foundBranch.name}. Week offs and salary remain individual.`;
            branchHint.style.display = "block";
          }
          document.getElementById("admin-detail-in-hour").value = foundBranch.checkInTimeHours ?? 9;
          document.getElementById("admin-detail-in-min").value = foundBranch.checkInTimeMinutes ?? 0;
          document.getElementById("admin-detail-out-hour").value = foundBranch.checkOutTimeHours ?? 17;
          document.getElementById("admin-detail-out-min").value = foundBranch.checkOutTimeMinutes ?? 0;
          document.getElementById("admin-detail-lat").value = foundBranch.targetLatitude || 0;
          document.getElementById("admin-detail-lon").value = foundBranch.targetLongitude || 0;
          document.getElementById("admin-detail-radius").value = foundBranch.targetRadiusMeters || 100;
          initOrRefreshAdminMap();
        }
      } else {
        if (branchHint) branchHint.style.display = "none";
      }
    };
  }

  document.getElementById("admin-detail-in-hour").value = s.checkInTimeHours ?? 9;
  document.getElementById("admin-detail-in-min").value = s.checkInTimeMinutes ?? 0;
  document.getElementById("admin-detail-out-hour").value = s.checkOutTimeHours ?? 17;
  document.getElementById("admin-detail-out-min").value = s.checkOutTimeMinutes ?? 0;

  for (let i = 1; i <= 7; i++) {
    const chk = document.getElementById(`chk-off-${i}`);
    if (chk) chk.checked = (s.weekOffs || [1, 7]).includes(i);
  }

  document.getElementById("admin-detail-lat").value = s.targetLatitude || 0;
  document.getElementById("admin-detail-lon").value = s.targetLongitude || 0;
  document.getElementById("admin-detail-radius").value = s.targetRadiusMeters || 100;

  // Render the employee's attendance calendar and attendance records
  renderAdminEmployeeCalendar();
  renderAdminEmployeeDateRecords();

  showView(viewAdminDetail);
}

// Toggle Settings Modal with Interactive Map Refresh
const btnToggleAdminEmpSettings = document.getElementById("btn-toggle-admin-emp-settings");
const modalAdminEmpSettings = document.getElementById("modal-admin-employee-settings");
const btnCloseEmpSettingsModal = document.getElementById("btn-close-emp-settings-modal");

if (btnToggleAdminEmpSettings) {
  btnToggleAdminEmpSettings.addEventListener("click", () => {
    if (modalAdminEmpSettings) {
      modalAdminEmpSettings.classList.add("open");
      initOrRefreshAdminMap();
    }
  });
}
if (btnCloseEmpSettingsModal) {
  btnCloseEmpSettingsModal.addEventListener("click", () => {
    if (modalAdminEmpSettings) modalAdminEmpSettings.classList.remove("open");
  });
}

// Month Navigation in Employee Attendance
const btnAdminEmpPrevMonth = document.getElementById("btn-admin-emp-prev-month");
if (btnAdminEmpPrevMonth) {
  btnAdminEmpPrevMonth.addEventListener("click", () => {
    adminEmpCalendarDate.setMonth(adminEmpCalendarDate.getMonth() - 1);
    renderAdminEmployeeCalendar();
  });
}

const btnAdminEmpNextMonth = document.getElementById("btn-admin-emp-next-month");
if (btnAdminEmpNextMonth) {
  btnAdminEmpNextMonth.addEventListener("click", () => {
    adminEmpCalendarDate.setMonth(adminEmpCalendarDate.getMonth() + 1);
    renderAdminEmployeeCalendar();
  });
}

// Render Employee Attendance Calendar (Matches Android CalendarAttendanceView)
function renderAdminEmployeeCalendar() {
  if (!adminDetailEmployeeId) return;

  const year = adminEmpCalendarDate.getFullYear();
  const month = adminEmpCalendarDate.getMonth();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const labelEl = document.getElementById("disp-admin-emp-month-year");
  if (labelEl) labelEl.textContent = `${monthNames[month]} ${year}`;

  const gridEl = document.getElementById("admin-emp-calendar-grid");
  if (!gridEl) return;

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dayHeaders = ["S", "M", "T", "W", "T", "F", "S"];
  let html = dayHeaders.map(h => `
    <div style="font-weight: 700; color: #9E9E9E; font-size: 0.78rem; padding: 6px 0; text-align: center;">${h}</div>
  `).join("");

  // Leading empty slots before the 1st of the month
  for (let i = 0; i < firstDayIndex; i++) {
    html += `<div></div>`;
  }

  const s = getMySettings(adminDetailEmployeeId);
  const weekOffs = s.weekOffs || [1, 7]; // 1 = Sun, 7 = Sat

  const empAtts = attendances.filter(a => a.employeeId.toLowerCase() === adminDetailEmployeeId.toLowerCase());
  const empLeaves = leaveRequests.filter(l => l.employeeId.toLowerCase() === adminDetailEmployeeId.toLowerCase() && l.status === "APPROVED");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Active month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dayOfWeek = dateObj.getDay() + 1; // 1 = Sun, 7 = Sat
    const isWeekOff = weekOffs.includes(dayOfWeek);

    const dayAtts = empAtts.filter(a => {
      const ad = new Date(a.timestamp);
      return ad.getFullYear() === year && ad.getMonth() === month && ad.getDate() === d;
    });
    const hasIn = dayAtts.some(a => (a.type || "").toUpperCase().trim() === "IN");
    const hasOut = dayAtts.some(a => (a.type || "").toUpperCase().trim() === "OUT");
    const isPresent = hasIn && hasOut;

    const hasApprovedLeave = empLeaves.some(l => {
      const ld = new Date(l.dateTimestamp);
      return ld.getFullYear() === year && ld.getMonth() === month && ld.getDate() === d;
    });

    let dotColor = "transparent";
    if (isWeekOff) {
      dotColor = "#9E9E9E"; // Week Off (Gray)
    } else if (hasApprovedLeave) {
      dotColor = "#F57C00"; // Leave (Orange)
    } else if (isPresent) {
      dotColor = "#2E7D32"; // Present (Green - both IN and OUT completed)
    } else if (dateObj <= today) {
      dotColor = "#D32F2F"; // Absent (Red - only marked present if both IN and OUT are done)
    }

    const isSelected = (
      adminEmpSelectedDate.getFullYear() === year &&
      adminEmpSelectedDate.getMonth() === month &&
      adminEmpSelectedDate.getDate() === d
    );

    html += `
      <div class="admin-cal-day-cell" data-day="${d}" style="padding: 6px 0; cursor: pointer; border-radius: 8px; text-align: center; transition: background 0.15s; ${isSelected ? 'background: #FFEBEE; border: 1.5px solid #E53935;' : 'border: 1.5px solid transparent;'}">
        <div style="font-size: 0.88rem; font-weight: ${isSelected ? '700' : '500'}; color: ${isSelected ? '#E53935' : '#1C1B1F'};">${d}</div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background: ${dotColor}; margin: 3px auto 0;"></div>
      </div>
    `;
  }

  gridEl.innerHTML = html;

  gridEl.querySelectorAll(".admin-cal-day-cell").forEach(cell => {
    cell.addEventListener("click", () => {
      const dayNum = parseInt(cell.getAttribute("data-day"));
      adminEmpSelectedDate = new Date(year, month, dayNum);
      renderAdminEmployeeCalendar();
      renderAdminEmployeeDateRecords();
    });
  });
}


// Render Attendance Records for Selected Date
function renderAdminEmployeeDateRecords() {
  if (!adminDetailEmployeeId) return;

  const recordsContainer = document.getElementById("admin-emp-date-records");
  const dateTitle = document.getElementById("admin-emp-selected-date-title");
  if (!recordsContainer) return;

  const dateStr = adminEmpSelectedDate.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
  if (dateTitle) dateTitle.textContent = `Attendances for ${dateStr}`;

  const selYear = adminEmpSelectedDate.getFullYear();
  const selMonth = adminEmpSelectedDate.getMonth();
  const selDay = adminEmpSelectedDate.getDate();

  const dayAtts = attendances.filter(a => {
    if (a.employeeId.toLowerCase() !== adminDetailEmployeeId.toLowerCase()) return false;
    const d = new Date(a.timestamp);
    return d.getFullYear() === selYear && d.getMonth() === selMonth && d.getDate() === selDay;
  }).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  if (dayAtts.length === 0) {
    recordsContainer.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 16px; background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 12px;">No attendance records for this date.</div>`;
    return;
  }

  const s = getMySettings(adminDetailEmployeeId);
  const targetLat = s.targetLatitude || 0;
  const targetLon = s.targetLongitude || 0;

  recordsContainer.innerHTML = dayAtts.map(att => {
    const timeStr = new Date(att.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const isClockIn = (att.type || "IN") === "IN";
    const typeColor = isClockIn ? "#2E7D32" : "#D32F2F";
    const hasPhoto = att.photoUri && att.photoUri.length > 20;

    let distanceText = "";
    if (att.latitude && att.longitude && targetLat !== 0 && targetLon !== 0) {
      const dist = Math.round(calculateDistanceMeters(att.latitude, att.longitude, targetLat, targetLon));
      distanceText = ` - ${dist}m from office`;
    }

    return `
      <div style="background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 12px; padding: 14px; display: flex; align-items: center; gap: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        ${hasPhoto ?
        `<img src="${att.photoUri}" style="width: 52px; height: 52px; border-radius: 10px; object-fit: cover; flex-shrink: 0;" alt="Selfie">` :
        `<div style="width: 52px; height: 52px; border-radius: 10px; background: #EEEEEE; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); flex-shrink: 0;">No Pic</div>`
      }
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: 700; font-size: 1.05rem; color: ${typeColor};">${att.type || "IN"}</span>
            <span style="font-size: 0.9rem; color: var(--text-secondary); font-weight: 500;">${timeStr}</span>
          </div>
          ${att.latitude ?
        `<div style="font-size: 0.8rem; color: var(--text-secondary);">GPS: ${att.latitude.toFixed(4)}, ${att.longitude.toFixed(4)}${distanceText}</div>` :
        `<div style="font-size: 0.8rem; color: var(--text-secondary);">Recorded via Web/Mobile</div>`
      }
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// ADMIN EMPLOYEE MAP & LOCATION PICKER (Interactive Google Maps / Leaflet)
// ==========================================
let adminMap = null;
let adminMapMarker = null;
let adminMapCircle = null;

function initOrRefreshAdminMap() {
  const mapContainer = document.getElementById("admin-map-view");
  if (!mapContainer) return;

  if (typeof L === "undefined") {
    console.warn("Leaflet map library is loading or unavailable.");
    return;
  }

  const latInput = document.getElementById("admin-detail-lat");
  const lonInput = document.getElementById("admin-detail-lon");
  const radiusInput = document.getElementById("admin-detail-radius");

  let lat = parseFloat(latInput.value) || 0;
  let lon = parseFloat(lonInput.value) || 0;
  let radius = parseFloat(radiusInput.value) || 100;

  const isDefault = (lat === 0 && lon === 0);
  if (isDefault) {
    if (currentGpsLocation) {
      lat = currentGpsLocation.lat;
      lon = currentGpsLocation.lon;
    } else {
      // Default to India center if unconfigured
      lat = 20.5937;
      lon = 78.9629;
    }
  }

  // Pin SVG (Google Maps Red Marker style)
  const pinSvg = `
    <svg width="34" height="46" viewBox="0 0 34 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 46 17 46C17 46 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="#EA4335"/>
      <circle cx="17" cy="17" r="7" fill="#FFFFFF"/>
      <circle cx="17" cy="17" r="3.5" fill="#EA4335"/>
    </svg>
  `;
  const pinIcon = L.divIcon({
    className: "custom-map-pin",
    html: pinSvg,
    iconSize: [34, 46],
    iconAnchor: [17, 46],
    popupAnchor: [0, -46]
  });

  if (!adminMap) {
    adminMap = L.map("admin-map-view", {
      zoomControl: true,
      attributionControl: false
    }).setView([lat, lon], isDefault ? 5 : 16);

    // Real Google Maps Tiles (Roadmap & Satellite - 100% Free, NO API Key needed!)
    const googleRoadmap = L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      maxZoom: 20
    });
    const googleSatellite = L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
      maxZoom: 20
    });
    googleRoadmap.addTo(adminMap);

    L.control.layers({
      "Google Map": googleRoadmap,
      "Satellite": googleSatellite
    }, null, { position: "topright" }).addTo(adminMap);

    // Marker
    adminMapMarker = L.marker([lat, lon], {
      draggable: true,
      icon: pinIcon
    }).addTo(adminMap);

    // Geofence Radius Circle
    adminMapCircle = L.circle([lat, lon], {
      radius: radius,
      color: "#1A73E8",
      weight: 2,
      fillColor: "#4285F4",
      fillOpacity: 0.22
    }).addTo(adminMap);

    // Tap/Click anywhere on map to set location
    adminMap.on("click", (e) => {
      setAdminMapPosition(e.latlng.lat, e.latlng.lng, true);
    });

    // Drag pin to set location
    adminMapMarker.on("drag", (e) => {
      const pos = e.target.getLatLng();
      if (adminMapCircle) adminMapCircle.setLatLng(pos);
      if (latInput) latInput.value = pos.lat.toFixed(6);
      if (lonInput) lonInput.value = pos.lng.toFixed(6);
    });

    adminMapMarker.on("dragend", (e) => {
      const pos = e.target.getLatLng();
      setAdminMapPosition(pos.lat, pos.lng, true);
    });

  } else {
    setAdminMapPosition(lat, lon, false);
    adminMap.setView([lat, lon], isDefault ? 5 : 16);
  }

  // Recalculate dimensions after modal popup transition
  setTimeout(() => {
    if (adminMap) adminMap.invalidateSize();
  }, 250);
}

function setAdminMapPosition(lat, lon, updateInputs = true) {
  const latInput = document.getElementById("admin-detail-lat");
  const lonInput = document.getElementById("admin-detail-lon");
  const radiusInput = document.getElementById("admin-detail-radius");
  const radius = parseFloat(radiusInput ? radiusInput.value : 100) || 100;

  if (updateInputs) {
    if (latInput) latInput.value = lat.toFixed(6);
    if (lonInput) lonInput.value = lon.toFixed(6);
  }

  if (adminMapMarker) {
    adminMapMarker.setLatLng([lat, lon]);
  }
  if (adminMapCircle) {
    adminMapCircle.setLatLng([lat, lon]);
    adminMapCircle.setRadius(radius);
  }
  if (adminMap && updateInputs) {
    adminMap.panTo([lat, lon]);
  }
}

// Search Address / Landmark via Geocoding
const btnAdminMapSearch = document.getElementById("btn-admin-map-search");
const inputAdminMapSearch = document.getElementById("admin-map-search-input");

async function executeAdminMapSearch() {
  const query = inputAdminMapSearch ? inputAdminMapSearch.value.trim() : "";
  if (!query) {
    alert("Please enter an address or landmark to search.");
    return;
  }

  if (btnAdminMapSearch) {
    btnAdminMapSearch.disabled = true;
    btnAdminMapSearch.textContent = "Searching...";
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const data = await res.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      setAdminMapPosition(lat, lon, true);
      if (adminMap) adminMap.setView([lat, lon], 16);
    } else {
      alert("Location not found. Please try searching with city or postal code.");
    }
  } catch (err) {
    console.error("Map search error:", err);
    alert("Could not perform search. Please check your internet connection.");
  } finally {
    if (btnAdminMapSearch) {
      btnAdminMapSearch.disabled = false;
      btnAdminMapSearch.textContent = "Search";
    }
  }
}

if (btnAdminMapSearch) {
  btnAdminMapSearch.addEventListener("click", executeAdminMapSearch);
}
if (inputAdminMapSearch) {
  inputAdminMapSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeAdminMapSearch();
    }
  });
}

// Live Radius Update on Circle
const inputAdminDetailRadius = document.getElementById("admin-detail-radius");
if (inputAdminDetailRadius) {
  inputAdminDetailRadius.addEventListener("input", () => {
    const r = parseFloat(inputAdminDetailRadius.value) || 100;
    if (adminMapCircle) adminMapCircle.setRadius(r);
  });
}

// Live Manual Lat/Lon Edits Update Pin on Map
const inputAdminDetailLat = document.getElementById("admin-detail-lat");
const inputAdminDetailLon = document.getElementById("admin-detail-lon");

function onManualCoordChange() {
  const lat = parseFloat(inputAdminDetailLat.value);
  const lon = parseFloat(inputAdminDetailLon.value);
  if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
    setAdminMapPosition(lat, lon, false);
    if (adminMap) adminMap.panTo([lat, lon]);
  }
}

if (inputAdminDetailLat) inputAdminDetailLat.addEventListener("input", onManualCoordChange);
if (inputAdminDetailLon) inputAdminDetailLon.addEventListener("input", onManualCoordChange);

// Current GPS Location Button
const btnAdminDetailFillGps = document.getElementById("btn-admin-detail-fill-gps");
if (btnAdminDetailFillGps) {
  btnAdminDetailFillGps.addEventListener("click", () => {
    if (navigator.geolocation) {
      btnAdminDetailFillGps.textContent = "Acquiring GPS...";
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          btnAdminDetailFillGps.textContent = "My Current GPS";
          setAdminMapPosition(pos.coords.latitude, pos.coords.longitude, true);
          if (adminMap) adminMap.setView([pos.coords.latitude, pos.coords.longitude], 17);
        },
        (err) => {
          btnAdminDetailFillGps.textContent = "My Current GPS";
          alert("Could not fetch GPS: " + err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  });
}

// View on Google Maps Website Button
const btnAdminOpenGmaps = document.getElementById("btn-admin-open-gmaps");
if (btnAdminOpenGmaps) {
  btnAdminOpenGmaps.addEventListener("click", () => {
    const lat = parseFloat(document.getElementById("admin-detail-lat").value) || 0;
    const lon = parseFloat(document.getElementById("admin-detail-lon").value) || 0;
    if (lat !== 0 || lon !== 0) {
      window.open(`https://www.google.com/maps?q=${lat},${lon}`, "_blank");
    } else {
      alert("Please select or search a location on the map first.");
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
      branch: (document.getElementById("admin-detail-branch")?.value || "").trim(),
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
      if (modalAdminEmpSettings) modalAdminEmpSettings.classList.remove("open");

      // Refresh the view details and dashboard
      openAdminEmployeeDetail(empId);
      renderAdminDashboard();
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    }
  });
}

// 5. Manage Leave Requests Screen (Matches Android ManageLeavesScreen.kt)
function renderAdminLeavesList() {
  const leavesListEl = document.getElementById("admin-leaves-list");
  const branchFilterContainer = document.getElementById("admin-leaves-branch-filter-container");
  if (!leavesListEl) return;

  if (branchFilterContainer) {
    const branchCounts = {};
    let unassignedCount = 0;
    leaveRequests.forEach(req => {
      const s = getMySettings(req.employeeId);
      if (s.branch) {
        branchCounts[s.branch] = (branchCounts[s.branch] || 0) + 1;
      } else {
        unassignedCount++;
      }
    });

    let filterHtml = `
      <button type="button" class="btn-text branch-filter-pill ${adminSelectedLeavesBranchFilter === 'ALL' ? 'active-filter' : ''}" data-branch="ALL">
        All (${leaveRequests.length})
      </button>
    `;

    branchesList.forEach(b => {
      const count = branchCounts[b.name] || 0;
      const isAct = adminSelectedLeavesBranchFilter.toLowerCase() === (b.name || "").toLowerCase();
      filterHtml += `
        <button type="button" class="btn-text branch-filter-pill ${isAct ? 'active-filter' : ''}" data-branch="${b.name}">
          ${b.name} (${count})
        </button>
      `;
    });

    if (unassignedCount > 0 || branchesList.length > 0) {
      const isUnassignedAct = adminSelectedLeavesBranchFilter === 'UNASSIGNED';
      filterHtml += `
        <button type="button" class="btn-text branch-filter-pill ${isUnassignedAct ? 'active-filter' : ''}" data-branch="UNASSIGNED">
          Unassigned (${unassignedCount})
        </button>
      `;
    }

    branchFilterContainer.innerHTML = filterHtml;
    branchFilterContainer.querySelectorAll(".branch-filter-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        adminSelectedLeavesBranchFilter = pill.getAttribute("data-branch");
        renderAdminLeavesList();
      });
    });
  }

  let filteredLeaves = leaveRequests.slice();
  if (adminSelectedLeavesBranchFilter === "UNASSIGNED") {
    filteredLeaves = filteredLeaves.filter(req => !getMySettings(req.employeeId).branch);
  } else if (adminSelectedLeavesBranchFilter !== "ALL") {
    filteredLeaves = filteredLeaves.filter(req => (getMySettings(req.employeeId).branch || "").toLowerCase() === adminSelectedLeavesBranchFilter.toLowerCase());
  }

  // Sort by branch, then by requestedAtTimestamp descending
  filteredLeaves.sort((a, b) => {
    const brA = (getMySettings(a.employeeId).branch || "ZZZ_NoBranch").toLowerCase();
    const brB = (getMySettings(b.employeeId).branch || "ZZZ_NoBranch").toLowerCase();
    if (brA !== brB) return brA.localeCompare(brB);
    return (b.requestedAtTimestamp || 0) - (a.requestedAtTimestamp || 0);
  });

  if (filteredLeaves.length === 0) {
    leavesListEl.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 24px;">No leave requests found.</div>`;
    return;
  }

  leavesListEl.innerHTML = filteredLeaves.map(req => {
    const s = getMySettings(req.employeeId);
    const empName = (s.displayName && s.displayName.trim().length > 0) ? s.displayName.trim() : req.employeeId;
    const branchName = s.branch || "Unassigned";
    const dateStr = new Date(req.dateTimestamp).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
    const isPending = req.status === "PENDING";
    const statusColor = req.status === "APPROVED" ? "#2E7D32" : (req.status === "REJECTED" ? "#C62828" : "#E65100");

    return `
      <div style="background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <div style="font-size: 1rem; font-weight: 600; color: var(--primary);">Employee: ${empName}</div>
          <span class="branch-badge ${s.branch ? '' : 'unassigned'}">${branchName}</span>
        </div>
        <div style="font-size: 0.95rem; margin-bottom: 4px; color: var(--text-primary);">Date: ${dateStr}</div>
        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 12px;">Reason: ${req.reason || "N/A"}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="font-weight: 600; font-size: 0.9rem;">Status: <span style="color: ${statusColor}; font-weight: 700;">${req.status}</span></div>
          ${isPending ? `
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn-m3 btn-approve-leave" data-id="${req.id}" style="height: 38px; padding: 0 16px; margin-bottom: 0;">Approve</button>
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
  const branchFilterContainer = document.getElementById("admin-report-branch-filter-container");
  if (!cardsContainer) return;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (monthYearLabel) {
    monthYearLabel.textContent = `${monthNames[reportSelectedMonth]} ${reportSelectedYear}`;
  }
  const exportBtnLabel = document.getElementById("txt-export-excel-btn");
  if (exportBtnLabel) {
    exportBtnLabel.textContent = `Download ${monthNames[reportSelectedMonth]} Excel (.xlsx)`;
  }

  const allEmps = Array.from(new Set([
    ...employeeSettingsList.map(s => s.employeeId.toLowerCase()),
    ...attendances.map(a => a.employeeId.toLowerCase())
  ])).filter(e => e !== "admin");

  if (branchFilterContainer) {
    const branchCounts = {};
    let unassignedCount = 0;
    allEmps.forEach(empId => {
      const s = getMySettings(empId);
      if (s.branch) {
        branchCounts[s.branch] = (branchCounts[s.branch] || 0) + 1;
      } else {
        unassignedCount++;
      }
    });

    let filterHtml = `
      <button type="button" class="btn-text branch-filter-pill ${adminSelectedReportBranchFilter === 'ALL' ? 'active-filter' : ''}" data-branch="ALL">
        All (${allEmps.length})
      </button>
    `;

    branchesList.forEach(b => {
      const count = branchCounts[b.name] || 0;
      const isAct = adminSelectedReportBranchFilter.toLowerCase() === (b.name || "").toLowerCase();
      filterHtml += `
        <button type="button" class="btn-text branch-filter-pill ${isAct ? 'active-filter' : ''}" data-branch="${b.name}">
          ${b.name} (${count})
        </button>
      `;
    });

    if (unassignedCount > 0 || branchesList.length > 0) {
      const isUnassignedAct = adminSelectedReportBranchFilter === 'UNASSIGNED';
      filterHtml += `
        <button type="button" class="btn-text branch-filter-pill ${isUnassignedAct ? 'active-filter' : ''}" data-branch="UNASSIGNED">
          Unassigned (${unassignedCount})
        </button>
      `;
    }

    branchFilterContainer.innerHTML = filterHtml;
    branchFilterContainer.querySelectorAll(".branch-filter-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        adminSelectedReportBranchFilter = pill.getAttribute("data-branch");
        renderMonthlyReportScreen();
      });
    });
  }

  let filteredEmps = allEmps.slice();
  if (adminSelectedReportBranchFilter === "UNASSIGNED") {
    filteredEmps = allEmps.filter(empId => !getMySettings(empId).branch);
  } else if (adminSelectedReportBranchFilter !== "ALL") {
    filteredEmps = allEmps.filter(empId => (getMySettings(empId).branch || "").toLowerCase() === adminSelectedReportBranchFilter.toLowerCase());
  }

  // Sort employees by branch, then by employee display name / ID
  filteredEmps.sort((a, b) => {
    const brA = (getMySettings(a).branch || "ZZZ_NoBranch").toLowerCase();
    const brB = (getMySettings(b).branch || "ZZZ_NoBranch").toLowerCase();
    if (brA !== brB) return brA.localeCompare(brB);
    const nameA = (getMySettings(a).displayName || a).toLowerCase();
    const nameB = (getMySettings(b).displayName || b).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  if (filteredEmps.length === 0) {
    cardsContainer.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 24px;">No employees found.</div>`;
    return;
  }

  cardsContainer.innerHTML = filteredEmps.map(empId => {
    const s = getMySettings(empId);
    const name = (s.displayName && s.displayName.trim().length > 0) ? s.displayName.trim() : empId;
    const branchName = s.branch || "Unassigned";
    const calc = calculateSalaryForEmployee(empId, reportSelectedYear, reportSelectedMonth);

    return `
      <div style="background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-size: 1.05rem; font-weight: 600; color: var(--text-primary);">${name}</div>
            <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px;">${empId}</div>
          </div>
          <span class="branch-badge ${s.branch ? '' : 'unassigned'}">${branchName}</span>
        </div>

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

// ==========================================
// Native Multi-Sheet Excel (.xlsx) Report Generator
// ==========================================
function generateMonthlyExcelReport(targetYear, targetMonth) {
  if (typeof XLSX === "undefined") {
    alert("Excel generator library is loading, please try again in a moment.");
    return;
  }

  const y = (typeof targetYear === "number") ? targetYear : reportSelectedYear;
  const m = (typeof targetMonth === "number") ? targetMonth : reportSelectedMonth;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthName = monthNames[m] || `Month_${m + 1}`;
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const allEmps = Array.from(new Set([
    ...employeeSettingsList.map(s => s.employeeId.toLowerCase()),
    ...attendances.map(a => a.employeeId.toLowerCase())
  ])).filter(e => e !== "admin");

  if (allEmps.length === 0) {
    alert("No employee records found to generate monthly report.");
    return;
  }

  // Sort employees by Branch (alphabetical, unassigned at bottom), then Display Name
  allEmps.sort((a, b) => {
    const brA = (getMySettings(a).branch || "ZZZ_NoBranch").toLowerCase();
    const brB = (getMySettings(b).branch || "ZZZ_NoBranch").toLowerCase();
    if (brA !== brB) return brA.localeCompare(brB);
    const nameA = (getMySettings(a).displayName || a).toLowerCase();
    const nameB = (getMySettings(b).displayName || b).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // ----------------------------------------------------
  // SHEET 1: Monthly Summary & Payroll
  // ----------------------------------------------------
  const summaryAOA = [];
  summaryAOA.push(["ATTENDPRO - MONTHLY ATTENDANCE & PAYROLL REPORT"]);
  summaryAOA.push([`Month & Year: ${monthName} ${y}`, "", "", `Generated: ${new Date().toLocaleString()}`]);
  summaryAOA.push([]); // blank line

  summaryAOA.push([
    "S.No",
    "Branch",
    "Employee ID",
    "Employee Name",
    "Base Salary (₹)",
    "Total Working Days",
    "Days Present",
    "Approved Leaves",
    "Days Absent",
    "Per Day Salary (₹)",
    "Deductions (₹)",
    "Net Payable Salary (₹)"
  ]);

  let totalBaseSalary = 0;
  let totalPresentDays = 0;
  let totalLeaves = 0;
  let totalAbsent = 0;
  let totalDeductions = 0;
  let totalNetSalary = 0;

  allEmps.forEach((empId, idx) => {
    const s = getMySettings(empId);
    const name = (s.displayName && s.displayName.trim().length > 0) ? s.displayName.trim() : empId;
    const branchName = s.branch || "Unassigned";
    const calc = calculateSalaryForEmployee(empId, y, m);

    totalBaseSalary += calc.baseSalary;
    totalPresentDays += calc.presentDays;
    totalLeaves += calc.approvedLeaveDays;
    totalAbsent += calc.absentDays;
    totalDeductions += calc.deduction;
    totalNetSalary += calc.netSalary;

    summaryAOA.push([
      idx + 1,
      branchName,
      empId,
      name,
      Number(calc.baseSalary),
      calc.totalWorkingDays,
      calc.presentDays,
      calc.approvedLeaveDays,
      calc.absentDays,
      Number(calc.perDaySalary.toFixed(2)),
      Number(calc.deduction.toFixed(2)),
      Number(calc.netSalary.toFixed(2))
    ]);
  });

  // Totals row at the bottom of Summary
  summaryAOA.push([
    "TOTAL",
    "-",
    `${allEmps.length} Employees`,
    "-",
    Number(totalBaseSalary),
    "-",
    totalPresentDays,
    totalLeaves,
    totalAbsent,
    "-",
    Number(totalDeductions.toFixed(2)),
    Number(totalNetSalary.toFixed(2))
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAOA);
  wsSummary["!cols"] = [
    { wch: 6 },  // S.No
    { wch: 18 }, // Branch
    { wch: 28 }, // Employee ID
    { wch: 22 }, // Employee Name
    { wch: 16 }, // Base Salary
    { wch: 18 }, // Working Days
    { wch: 14 }, // Present
    { wch: 16 }, // Leaves
    { wch: 14 }, // Absent
    { wch: 18 }, // Per Day Salary
    { wch: 16 }, // Deductions
    { wch: 22 }  // Net Payable Salary
  ];

  // ----------------------------------------------------
  // SHEET 2: Daily Attendance Matrix (Day 1 to Day 31)
  // ----------------------------------------------------
  const matrixAOA = [];
  matrixAOA.push([`DAILY ATTENDANCE BREAKDOWN - ${monthName.toUpperCase()} ${y}`]);
  matrixAOA.push(["Legend: P = Present (Both IN & OUT) | IN = In Only | OUT = Out Only | L = Approved Leave | WO = Week Off | A = Absent | - = Upcoming"]);
  matrixAOA.push([]); // blank line

  const weekdayShorts = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const matrixHeader = ["S.No", "Branch", "Employee ID", "Employee Name"];
  for (let d = 1; d <= daysInMonth; d++) {
    const curDate = new Date(y, m, d);
    const wd = weekdayShorts[curDate.getDay()];
    matrixHeader.push(`${d} (${wd})`);
  }
  matrixHeader.push("Total Present", "Approved Leaves", "Days Absent", "Attendance %");
  matrixAOA.push(matrixHeader);

  const today = new Date();
  const isCurrentMonth = (today.getFullYear() === y && today.getMonth() === m);
  const currentDay = today.getDate();

  allEmps.forEach((empId, idx) => {
    const s = getMySettings(empId);
    const name = (s.displayName && s.displayName.trim().length > 0) ? s.displayName.trim() : empId;
    const branchName = s.branch || "Unassigned";
    const weekOffs = s.weekOffs || [1, 7]; // 1 = Sun, 7 = Sat

    // Map of day number -> { in: bool, out: bool }
    const dayPunches = {};
    attendances.forEach(a => {
      if (a.employeeId.toLowerCase() !== empId.toLowerCase()) return;
      const ad = new Date(a.timestamp);
      if (ad.getFullYear() === y && ad.getMonth() === m) {
        const dNum = ad.getDate();
        if (!dayPunches[dNum]) dayPunches[dNum] = { in: false, out: false };
        const t = (a.type || "").toUpperCase().trim();
        if (t === "IN") dayPunches[dNum].in = true;
        if (t === "OUT") dayPunches[dNum].out = true;
      }
    });

    // Set of approved leave dates
    const leaveDays = new Set();
    leaveRequests.forEach(l => {
      if (l.employeeId.toLowerCase() !== empId.toLowerCase()) return;
      if (l.status !== "APPROVED") return;
      const ld = new Date(l.dateTimestamp);
      if (ld.getFullYear() === y && ld.getMonth() === m) {
        leaveDays.add(ld.getDate());
      }
    });

    let countPresent = 0;
    let countLeave = 0;
    let countAbsent = 0;
    let countWorkingDays = 0;

    const row = [idx + 1, branchName, empId, name];

    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(y, m, d);
      const dayOfWeek = curDate.getDay() + 1; // 1 = Sun, 7 = Sat
      const isWeekOff = weekOffs.includes(dayOfWeek);
      const isFuture = isCurrentMonth && (d > currentDay);

      if (!isWeekOff && (!isCurrentMonth || d <= currentDay)) {
        countWorkingDays++;
      }

      if (isFuture) {
        row.push("-");
        continue;
      }

      const punches = dayPunches[d];
      const isLeave = leaveDays.has(d);

      if (punches && punches.in && punches.out) {
        row.push(isWeekOff ? "P (WO)" : "P");
        countPresent++;
      } else if (punches && punches.in) {
        row.push("IN");
      } else if (punches && punches.out) {
        row.push("OUT");
      } else if (isLeave) {
        row.push("L");
        countLeave++;
      } else if (isWeekOff) {
        row.push("WO");
      } else {
        row.push("A");
        countAbsent++;
      }
    }

    const attPct = countWorkingDays > 0 ? `${((countPresent / countWorkingDays) * 100).toFixed(1)}%` : "0.0%";
    row.push(countPresent, countLeave, countAbsent, attPct);
    matrixAOA.push(row);
  });

  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixAOA);
  const matrixCols = [
    { wch: 6 },  // S.No
    { wch: 18 }, // Branch
    { wch: 28 }, // Employee ID
    { wch: 22 }  // Employee Name
  ];
  for (let d = 1; d <= daysInMonth; d++) {
    matrixCols.push({ wch: 8 });
  }
  matrixCols.push({ wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 });
  wsMatrix["!cols"] = matrixCols;

  // ----------------------------------------------------
  // Build Workbook and Trigger Download
  // ----------------------------------------------------
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary & Payroll");
  XLSX.utils.book_append_sheet(wb, wsMatrix, "Daily Attendance");

  const fileName = `Monthly_Report_${monthName}_${y}.xlsx`;
  XLSX.writeFile(wb, fileName);

  showReportDownloadToast(`Report downloaded: ${fileName}`);
}

// ==========================================
// Export CSV for Monthly Report
// ==========================================
function exportMonthlyCsv(targetYear, targetMonth) {
  const y = (typeof targetYear === "number") ? targetYear : reportSelectedYear;
  const m = (typeof targetMonth === "number") ? targetMonth : reportSelectedMonth;

  const allEmps = Array.from(new Set([
    ...employeeSettingsList.map(s => s.employeeId.toLowerCase()),
    ...attendances.map(a => a.employeeId.toLowerCase())
  ])).filter(e => e !== "admin");

  allEmps.sort((a, b) => {
    const brA = (getMySettings(a).branch || "ZZZ_NoBranch").toLowerCase();
    const brB = (getMySettings(b).branch || "ZZZ_NoBranch").toLowerCase();
    if (brA !== brB) return brA.localeCompare(brB);
    const nameA = (getMySettings(a).displayName || a).toLowerCase();
    const nameB = (getMySettings(b).displayName || b).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  let csv = "Branch,Employee Name,Base Salary,Total Working Days,Days Present,Approved Leaves,Days Absent,Per Day Salary,Deduction,Net Salary\n";
  allEmps.forEach(empId => {
    const s = getMySettings(empId);
    const name = (s.displayName && s.displayName.trim().length > 0) ? s.displayName.trim() : empId;
    const branchName = s.branch || "No Branch";
    const calc = calculateSalaryForEmployee(empId, y, m);
    csv += `"${branchName}","${name}",${calc.baseSalary},${calc.totalWorkingDays},${calc.presentDays},${calc.approvedLeaveDays},${calc.absentDays},${calc.perDaySalary.toFixed(2)},${calc.deduction.toFixed(2)},${calc.netSalary.toFixed(2)}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `monthly_report_${y}_${m + 1}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showReportDownloadToast(`CSV Report downloaded for ${m + 1}/${y}`);
}

// ==========================================
// End-of-Month Detection and Smart Prompt
// ==========================================
function checkAndRenderEndOfMonthAlert() {
  if (!isAdmin) return;
  const container = document.getElementById("admin-eom-banner-container");
  if (!container) return;

  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth();
  const curD = now.getDate();
  const daysInCurMonth = new Date(curY, curM + 1, 0).getDate();

  // Target closed period: previous month
  let targetY = curY;
  let targetM = curM - 1;
  if (targetM < 0) {
    targetM = 11;
    targetY--;
  }

  // If in last 3 days of current month, also consider current month
  const isClosingCurrent = curD >= (daysInCurMonth - 2);
  const effectiveY = isClosingCurrent ? curY : targetY;
  const effectiveM = isClosingCurrent ? curM : targetM;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const targetMonthName = monthNames[effectiveM];

  const monthKey = `${effectiveY}-${String(effectiveM + 1).padStart(2, "0")}`;
  const isDismissed = localStorage.getItem("attend_eom_dismissed_month") === monthKey;

  if (isDismissed) {
    container.innerHTML = `
      <div class="eom-mini-badge" id="btn-reopen-eom">
        <span style="font-size: 0.82rem; font-weight: 600; color: #3730A3; display: flex; align-items: center; gap: 6px;">
          <span>📊</span> ${targetMonthName} ${effectiveY} Monthly Report Ready
        </span>
        <span style="font-size: 0.78rem; font-weight: 700; color: #4F46E5; text-decoration: underline;">
          Download Excel (.xlsx)
        </span>
      </div>
    `;
    const reopenEl = document.getElementById("btn-reopen-eom");
    if (reopenEl) {
      reopenEl.addEventListener("click", () => {
        generateMonthlyExcelReport(effectiveY, effectiveM);
      });
    }
    return;
  }

  container.innerHTML = `
    <div class="eom-banner-card" id="eom-card">
      <div class="eom-header">
        <div>
          <div class="eom-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            End of Month Report
          </div>
          <div class="eom-title">${targetMonthName} ${effectiveY} Monthly Report</div>
        </div>
        <button type="button" class="eom-btn-close" id="btn-dismiss-eom" title="Dismiss banner">&times;</button>
      </div>
      <div class="eom-desc">
        ${isClosingCurrent ? 'The current month attendance period is concluding.' : 'The previous month attendance and payroll period is completed.'} Generate the official multi-sheet Excel (.xlsx) file including employee summaries and the full daily punch matrix.
      </div>
      <div class="eom-actions">
        <button type="button" class="eom-btn-download" id="btn-eom-download">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          Download Excel Report
        </button>
        <button type="button" class="eom-btn-view" id="btn-eom-view">
          View Report
        </button>
      </div>
    </div>
  `;

  const btnDownload = document.getElementById("btn-eom-download");
  if (btnDownload) {
    btnDownload.addEventListener("click", () => {
      generateMonthlyExcelReport(effectiveY, effectiveM);
    });
  }

  const btnView = document.getElementById("btn-eom-view");
  if (btnView) {
    btnView.addEventListener("click", () => {
      reportSelectedYear = effectiveY;
      reportSelectedMonth = effectiveM;
      showView(viewAdminReport);
      renderMonthlyReportScreen();
    });
  }

  const btnDismiss = document.getElementById("btn-dismiss-eom");
  if (btnDismiss) {
    btnDismiss.addEventListener("click", () => {
      localStorage.setItem("attend_eom_dismissed_month", monthKey);
      checkAndRenderEndOfMonthAlert();
    });
  }
}

// Download Toast Helper
function showReportDownloadToast(message) {
  let toast = document.getElementById("report-download-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "report-download-toast";
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #111827;
      color: #FFFFFF;
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 0.88rem;
      font-weight: 500;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
      z-index: 999999;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 90%;
      pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.innerHTML = `
    <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: #10B981; border-radius: 50%; color: #FFF; font-size: 13px;">✓</span>
    <span>${message}</span>
  `;
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
  }, 4000);
}

// Wire up Monthly Report Export buttons
const btnAdminExportExcel = document.getElementById("btn-admin-export-excel");
if (btnAdminExportExcel) {
  btnAdminExportExcel.addEventListener("click", () => {
    generateMonthlyExcelReport(reportSelectedYear, reportSelectedMonth);
  });
}

const btnAdminLastMonthExcel = document.getElementById("btn-admin-last-month-excel");
if (btnAdminLastMonthExcel) {
  btnAdminLastMonthExcel.addEventListener("click", () => {
    const now = new Date();
    let prevY = now.getFullYear();
    let prevM = now.getMonth() - 1;
    if (prevM < 0) {
      prevM = 11;
      prevY--;
    }
    generateMonthlyExcelReport(prevY, prevM);
  });
}

const btnAdminExportReportCsv = document.getElementById("btn-admin-export-csv");
if (btnAdminExportReportCsv) {
  btnAdminExportReportCsv.addEventListener("click", () => {
    exportMonthlyCsv(reportSelectedYear, reportSelectedMonth);
  });
}

// ==========================================
// 6. Branch Management Screen & Modal Logic
// ==========================================
const modalAdminBranch = document.getElementById("modal-admin-branch");
const btnCloseBranchModal = document.getElementById("btn-close-branch-modal");
const btnAdminCreateBranch = document.getElementById("btn-admin-create-branch");
const formAdminBranch = document.getElementById("form-admin-branch");
const btnAdminBranchFillGps = document.getElementById("btn-admin-branch-fill-gps");

function renderAdminBranchesList() {
  const listEl = document.getElementById("admin-branches-list");
  if (!listEl) return;

  if (branchesList.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary); padding: 36px 16px; background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 14px;">
        
        <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 4px;">No Branches Created Yet</div>
        <div style="font-size: 0.85rem; max-width: 320px; margin: 0 auto 16px;">Create branches to group employees with shared shift timings and office geofence locations.</div>
        <button type="button" class="btn-m3" onclick="window.triggerCreateBranch && window.triggerCreateBranch()" style="max-width: 220px; margin: 0 auto; background: var(--primary);"> Create First Branch</button>
      </div>
    `;
    return;
  }

  listEl.innerHTML = branchesList.map(b => {
    const assignedCount = employeeSettingsList.filter(s => (s.branch || "").toLowerCase() === (b.name || "").toLowerCase()).length;
    const inH = String(b.checkInTimeHours ?? 9).padStart(2, "0");
    const inM = String(b.checkInTimeMinutes ?? 0).padStart(2, "0");
    const outH = String(b.checkOutTimeHours ?? 17).padStart(2, "0");
    const outM = String(b.checkOutTimeMinutes ?? 0).padStart(2, "0");

    let locationDesc = "GPS Not Set";
    if (b.targetLatitude && b.targetLongitude) {
      locationDesc = `${b.targetLatitude.toFixed(4)}, ${b.targetLongitude.toFixed(4)} (Radius: ${b.targetRadiusMeters || 100}m)`;
    }

    return `
      <div class="branch-card" style="background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 14px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
          <div>
            <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
              ${b.name}
            </div>
            <div style="font-size: 0.82rem; color: var(--primary); font-weight: 600; margin-top: 3px;">
              ${assignedCount} ${assignedCount === 1 ? 'employee' : 'employees'} assigned
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-text btn-edit-branch" data-id="${b.id}" style="font-size: 0.85rem; padding: 5px 10px; border: 1.5px solid var(--primary); border-radius: 8px; font-weight: 600;">Edit</button>
            <button type="button" class="btn-text btn-delete-branch" data-id="${b.id}" data-name="${b.name}" data-count="${assignedCount}" style="font-size: 0.85rem; padding: 5px 10px; border: 1.5px solid #D32F2F; color: #D32F2F; border-radius: 8px; font-weight: 600;">Delete</button>
          </div>
        </div>

        <div style="background: #F8F9FA; border-radius: 10px; padding: 12px; margin-bottom: 8px; font-size: 0.88rem; display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Shift Timing:</span>
            <span style="font-weight: 600;">${inH}:${inM} - ${outH}:${outM}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Office Location:</span>
            <span style="font-weight: 600; text-align: right; word-break: break-all;">${locationDesc}</span>
          </div>
        </div>

        <div style="font-size: 0.74rem; color: var(--text-secondary);">
          Employees under this branch inherit this shift time & location. Week offs remain individual per employee.
        </div>
      </div>
    `;
  }).join("");

  listEl.querySelectorAll(".btn-edit-branch").forEach(btn => {
    btn.addEventListener("click", () => {
      openBranchModal(btn.getAttribute("data-id"));
    });
  });

  listEl.querySelectorAll(".btn-delete-branch").forEach(btn => {
    btn.addEventListener("click", async () => {
      const bId = btn.getAttribute("data-id");
      const bName = btn.getAttribute("data-name");
      const count = parseInt(btn.getAttribute("data-count") || "0");

      let confirmMsg = `Are you sure you want to delete branch "${bName}"?`;
      if (count > 0) {
        confirmMsg = `Warning: ${count} employees are currently assigned to branch "${bName}". Deleting it will leave them unassigned. Proceed?`;
      }

      if (confirm(confirmMsg)) {
        try {
          const db = getDb();
          await deleteDoc(doc(db, "branches", bId));
          alert(`Branch "${bName}" deleted successfully.`);
        } catch (err) {
          console.error("Delete branch error:", err);
          alert("Failed to delete branch: " + err.message);
        }
      }
    });
  });
}

window.triggerCreateBranch = () => openBranchModal(null);

function openBranchModal(branchId = null) {
  editingBranchId = branchId;
  const titleEl = document.getElementById("modal-branch-title");
  const idInput = document.getElementById("admin-branch-id");
  const nameInput = document.getElementById("admin-branch-name");
  const inHInput = document.getElementById("admin-branch-in-hour");
  const inMInput = document.getElementById("admin-branch-in-min");
  const outHInput = document.getElementById("admin-branch-out-hour");
  const outMInput = document.getElementById("admin-branch-out-min");
  const latInput = document.getElementById("admin-branch-lat");
  const lonInput = document.getElementById("admin-branch-lon");
  const radiusInput = document.getElementById("admin-branch-radius");

  if (branchId) {
    const b = branchesList.find(x => x.id === branchId);
    if (!b) return;
    if (titleEl) titleEl.textContent = `Edit Branch: ${b.name}`;
    idInput.value = b.id;
    nameInput.value = b.name || "";
    inHInput.value = b.checkInTimeHours ?? 9;
    inMInput.value = b.checkInTimeMinutes ?? 0;
    outHInput.value = b.checkOutTimeHours ?? 17;
    outMInput.value = b.checkOutTimeMinutes ?? 0;
    latInput.value = b.targetLatitude || 0;
    lonInput.value = b.targetLongitude || 0;
    radiusInput.value = b.targetRadiusMeters || 100;
  } else {
    if (titleEl) titleEl.textContent = "Create New Branch";
    idInput.value = "";
    nameInput.value = "";
    inHInput.value = 9;
    inMInput.value = 0;
    outHInput.value = 17;
    outMInput.value = 0;
    latInput.value = currentGpsLocation ? currentGpsLocation.lat : 0;
    lonInput.value = currentGpsLocation ? currentGpsLocation.lon : 0;
    radiusInput.value = 100;
  }

  if (modalAdminBranch) modalAdminBranch.classList.add("open");
  initOrRefreshBranchMap();
}

function initOrRefreshBranchMap() {
  const mapContainer = document.getElementById("admin-branch-map-view");
  if (!mapContainer || typeof L === "undefined") return;

  const latInput = document.getElementById("admin-branch-lat");
  const lonInput = document.getElementById("admin-branch-lon");
  const radiusInput = document.getElementById("admin-branch-radius");

  let lat = parseFloat(latInput?.value) || 0;
  let lon = parseFloat(lonInput?.value) || 0;
  let radius = parseFloat(radiusInput?.value) || 100;

  const isDefault = (lat === 0 && lon === 0);
  if (isDefault) {
    if (currentGpsLocation) {
      lat = currentGpsLocation.lat;
      lon = currentGpsLocation.lon;
    } else {
      lat = 20.5937;
      lon = 78.9629;
    }
  }

  const pinSvg = `
    <svg width="34" height="46" viewBox="0 0 34 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 46 17 46C17 46 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="#3949AB"/>
      <circle cx="17" cy="17" r="7" fill="#FFFFFF"/>
      <circle cx="17" cy="17" r="3.5" fill="#3949AB"/>
    </svg>
  `;
  const pinIcon = L.divIcon({
    className: "custom-branch-map-pin",
    html: pinSvg,
    iconSize: [34, 46],
    iconAnchor: [17, 46],
    popupAnchor: [0, -46]
  });

  if (!branchMap) {
    branchMap = L.map("admin-branch-map-view", {
      zoomControl: true,
      attributionControl: false
    }).setView([lat, lon], isDefault ? 5 : 16);

    const googleRoadmap = L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", { maxZoom: 20 });
    googleRoadmap.addTo(branchMap);

    branchMapMarker = L.marker([lat, lon], { icon: pinIcon, draggable: true }).addTo(branchMap);
    branchMapCircle = L.circle([lat, lon], {
      color: "#3949AB",
      fillColor: "#3949AB",
      fillOpacity: 0.15,
      radius: radius
    }).addTo(branchMap);

    const updateFromMap = (newLat, newLon) => {
      if (latInput) latInput.value = newLat.toFixed(6);
      if (lonInput) lonInput.value = newLon.toFixed(6);
      branchMapMarker.setLatLng([newLat, newLon]);
      branchMapCircle.setLatLng([newLat, newLon]);
    };

    branchMap.on("click", (e) => updateFromMap(e.latlng.lat, e.latlng.lng));
    branchMapMarker.on("dragend", (e) => {
      const pos = e.target.getLatLng();
      updateFromMap(pos.lat, pos.lng);
    });

    if (radiusInput) {
      radiusInput.addEventListener("input", () => {
        const rad = parseFloat(radiusInput.value) || 100;
        if (branchMapCircle) branchMapCircle.setRadius(rad);
      });
    }
  } else {
    setTimeout(() => {
      branchMap.invalidateSize();
      branchMap.setView([lat, lon], isDefault ? 5 : 16);
      if (branchMapMarker) branchMapMarker.setLatLng([lat, lon]);
      if (branchMapCircle) {
        branchMapCircle.setLatLng([lat, lon]);
        branchMapCircle.setRadius(radius);
      }
    }, 200);
  }
}

if (btnAdminCreateBranch) {
  btnAdminCreateBranch.addEventListener("click", () => openBranchModal(null));
}

if (btnCloseBranchModal) {
  btnCloseBranchModal.addEventListener("click", () => {
    if (modalAdminBranch) modalAdminBranch.classList.remove("open");
  });
}

if (btnAdminBranchFillGps) {
  btnAdminBranchFillGps.addEventListener("click", () => {
    if (currentGpsLocation) {
      const latInput = document.getElementById("admin-branch-lat");
      const lonInput = document.getElementById("admin-branch-lon");
      if (latInput) latInput.value = currentGpsLocation.lat.toFixed(6);
      if (lonInput) lonInput.value = currentGpsLocation.lon.toFixed(6);
      initOrRefreshBranchMap();
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          currentGpsLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          const latInput = document.getElementById("admin-branch-lat");
          const lonInput = document.getElementById("admin-branch-lon");
          if (latInput) latInput.value = pos.coords.latitude.toFixed(6);
          if (lonInput) lonInput.value = pos.coords.longitude.toFixed(6);
          initOrRefreshBranchMap();
        },
        (err) => alert("Could not fetch GPS: " + err.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  });
}

if (formAdminBranch) {
  formAdminBranch.addEventListener("submit", async (e) => {
    e.preventDefault();
    const idInput = document.getElementById("admin-branch-id");
    const nameInput = document.getElementById("admin-branch-name");
    const inHInput = document.getElementById("admin-branch-in-hour");
    const inMInput = document.getElementById("admin-branch-in-min");
    const outHInput = document.getElementById("admin-branch-out-hour");
    const outMInput = document.getElementById("admin-branch-out-min");
    const latInput = document.getElementById("admin-branch-lat");
    const lonInput = document.getElementById("admin-branch-lon");
    const radiusInput = document.getElementById("admin-branch-radius");

    const name = nameInput.value.trim();
    if (!name) {
      alert("Please enter a branch name.");
      return;
    }

    const branchId = idInput.value || `branch_${Date.now()}`;
    const payload = {
      id: branchId,
      name: name,
      checkInTimeHours: parseInt(inHInput.value) || 9,
      checkInTimeMinutes: parseInt(inMInput.value) || 0,
      checkOutTimeHours: parseInt(outHInput.value) || 17,
      checkOutTimeMinutes: parseInt(outMInput.value) || 0,
      targetLatitude: parseFloat(latInput.value) || 0,
      targetLongitude: parseFloat(lonInput.value) || 0,
      targetRadiusMeters: parseFloat(radiusInput.value) || 100,
      updatedAt: Date.now()
    };

    try {
      const db = getDb();
      await setDoc(doc(db, "branches", branchId), payload, { merge: true });
      alert(`Branch "${name}" saved successfully!`);
      if (modalAdminBranch) modalAdminBranch.classList.remove("open");
      renderAdminBranchesList();
      refreshAdminViews();
    } catch (err) {
      console.error("Save branch error:", err);
      try {
        const fallbackDb = fallbackToDefaultDb();
        await setDoc(doc(fallbackDb, "branches", branchId), payload, { merge: true });
        alert(`Branch "${name}" saved successfully!`);
        if (modalAdminBranch) modalAdminBranch.classList.remove("open");
        renderAdminBranchesList();
        refreshAdminViews();
      } catch (err2) {
        alert("Failed to save branch: " + err2.message);
      }
    }
  });
}

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration error:', err));
  });
}



// --- Branch Office Map Search Feature ---
const btnAdminBranchMapSearch = document.getElementById("btn-admin-branch-map-search");
const inputAdminBranchMapSearch = document.getElementById("admin-branch-map-search-input");

async function executeAdminBranchMapSearch() {
  const query = inputAdminBranchMapSearch ? inputAdminBranchMapSearch.value.trim() : "";
  if (!query) {
    alert("Please enter an address, landmark or city to search.");
    return;
  }

  if (btnAdminBranchMapSearch) {
    btnAdminBranchMapSearch.disabled = true;
    btnAdminBranchMapSearch.textContent = "Searching...";
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const data = await res.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      const latInput = document.getElementById("admin-branch-lat");
      const lonInput = document.getElementById("admin-branch-lon");
      if (latInput) latInput.value = lat.toFixed(6);
      if (lonInput) lonInput.value = lon.toFixed(6);
      if (branchMap) {
        branchMap.setView([lat, lon], 16);
        if (branchMapMarker) branchMapMarker.setLatLng([lat, lon]);
        if (branchMapCircle) branchMapCircle.setLatLng([lat, lon]);
      }
    } else {
      alert("Location not found. Please try searching with city or postal code.");
    }
  } catch (err) {
    console.error("Branch map search error:", err);
    alert("Could not perform search. Please check your internet connection.");
  } finally {
    if (btnAdminBranchMapSearch) {
      btnAdminBranchMapSearch.disabled = false;
      btnAdminBranchMapSearch.textContent = "Search";
    }
  }
}

if (btnAdminBranchMapSearch) {
  btnAdminBranchMapSearch.addEventListener("click", executeAdminBranchMapSearch);
}
if (inputAdminBranchMapSearch) {
  inputAdminBranchMapSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeAdminBranchMapSearch();
    }
  });
}

// Live manual coordinate changes update Branch Map Pin
const inputAdminBranchLat = document.getElementById("admin-branch-lat");
const inputAdminBranchLon = document.getElementById("admin-branch-lon");
function onBranchManualCoordChange() {
  const lat = parseFloat(inputAdminBranchLat?.value);
  const lon = parseFloat(inputAdminBranchLon?.value);
  if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
    if (branchMapMarker) branchMapMarker.setLatLng([lat, lon]);
    if (branchMapCircle) branchMapCircle.setLatLng([lat, lon]);
    if (branchMap) branchMap.panTo([lat, lon]);
  }
}
if (inputAdminBranchLat) inputAdminBranchLat.addEventListener("input", onBranchManualCoordChange);
if (inputAdminBranchLon) inputAdminBranchLon.addEventListener("input", onBranchManualCoordChange);
