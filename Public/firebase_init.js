// firebase_init.js
// =======================================================
// Inisialisasi dan ekspor objek Firebase agar bisa dipakai
// oleh semua skrip (admin, guru, siswa, dll.) tanpa konflik.
// =======================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signOut 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  setDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  query,
  serverTimestamp, 
  onSnapshot,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";


// Firebase config (your project)
const firebaseConfig = {
  apiKey: "AIzaSyAXg6GUd0Aw1Ku0DmWKN0VNGgrbluO26i8",
  authDomain: "sistem-sekolah-6a1d5.firebaseapp.com",
  projectId: "sistem-sekolah-6a1d5",
  storageBucket: "sistem-sekolah-6a1d5.firebasestorage.app",
  messagingSenderId: "152901594945",
  appId: "1:152901594945:web:a672dd14fe231a89bebbc0"
};

// Logika PENTING untuk mencegah duplikasi inisialisasi
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);


// Export semua yang dibutuhkan
export { 
  app, 
  db, 
  storage, 
  auth, 
  signInWithEmailAndPassword,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signOut,
  collection, 
  getDocs, 
  addDoc, 
  setDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  query, 
  where,
  ref, 
  uploadBytes, 
  getDownloadURL,
  onSnapshot,
  orderBy,
  serverTimestamp,
};