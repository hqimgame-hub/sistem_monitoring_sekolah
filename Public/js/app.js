// =============================
// 🔥 Firebase Configuration
// =============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { 
  getFirestore, doc, getDoc, setDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// TODO: Ganti dengan konfigurasi Firebase milikmu
const firebaseConfig = {
  apiKey: "AIzaSyAXg6GUd0Aw1Ku0DmWKN0VNGgrbluO26i8",
  authDomain: "sistem-sekolah-6a1d5.firebaseapp.com",
  projectId: "sistem-sekolah-6a1d5",
  storageBucket: "sistem-sekolah-6a1d5.firebasestorage.app", // ✅ perbaikan di sini
  messagingSenderId: "152901594945",
  appId: "1:152901594945:web:a672dd14fe231a89bebbc0"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// =============================
// 🧠 Fungsi Login
// =============================
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Referensi dokumen user
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Buat user baru jika belum ada
        await setDoc(userRef, {
          nama: user.displayName,
          email: user.email,
          role: "guru", // default untuk pengguna baru
          created_at: serverTimestamp()
        });
      }

      // Ambil data user
      const userData = (await getDoc(userRef)).data();

      // Arahkan sesuai role
      if (userData.role === "admin") {
        window.location.href = "dashboard-admin.html";
      } else {
        window.location.href = "dashboard-guru.html";
      }

    } catch (error) {
      console.error("Login error:", error);
      alert("Gagal login: " + error.message);
    }
  });
}

// =============================
// 🚪 Fungsi Logout
// =============================
export function logout() {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
}
