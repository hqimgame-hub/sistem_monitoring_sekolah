// Mengimpor library dari Firebase CDN (versi modular SDK terbaru)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

// Konfigurasi Firebase (ambil dari Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyAXg6GUd0Aw1Ku0DmWKN0VNGgrbluO26i8",
  authDomain: "sistem-sekolah-6a1d5.firebaseapp.com",
  projectId: "sistem-sekolah-6a1d5",
  storageBucket: "sistem-sekolah-6a1d5.firebasestorage.app", // ✅ perbaikan di sini
  messagingSenderId: "152901594945",
  appId: "1:152901594945:web:a672dd14fe231a89bebbc0"
};

// Inisialisasi koneksi ke Firebase
//const app = initializeApp(firebaseConfig);
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
// Aktifkan layanan utama Firebase
const auth = getAuth(app);        // Untuk login / autentikasi
const db = getFirestore(app);     // Untuk database Firestore
const storage = getStorage(app);  // Untuk upload file atau gambar

// Ekspor supaya bisa digunakan file lain
export { app, auth, db, storage };
