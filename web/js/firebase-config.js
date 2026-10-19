// Firebase Configuration for AttendPro (attend-pro-ced53)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc,
  onSnapshot, 
  query, 
  where 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadString, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDon5gxz0H20FoIpR1TeY8SyJ6THgTqZrQ",
  authDomain: "attend-pro-ced53.firebaseapp.com",
  projectId: "attend-pro-ced53",
  storageBucket: "attend-pro-ced53.firebasestorage.app",
  messagingSenderId: "813393965121",
  appId: "1:813393965121:web:attendpro"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Firestore initialized to 'attend' database with fallback
let dbInstance;
try {
  dbInstance = getFirestore(app, "attend");
} catch (e) {
  console.warn("Could not init named db 'attend', falling back to default db:", e);
  dbInstance = getFirestore(app);
}
export const db = dbInstance;

export function getDb() {
  return db;
}

export function fallbackToDefaultDb() {
  try {
    return getFirestore(app);
  } catch (e) {
    return db;
  }
}

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  ref,
  uploadString,
  getDownloadURL
};
