// index.js (versi final 2025 dengan Perbaikan Robust Role Check)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword,
  signOut, 
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc,
  collection, 
  query, 
  where, 
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// 🔧 Konfigurasi Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAXg6GUd0Aw1Ku0DmWKN0VNGgrbluO26i8",
  authDomain: "sistem-sekolah-6a1d5.firebaseapp.com",
  projectId: "sistem-sekolah-6a1d5",
  storageBucket: "sistem-sekolah-6a1d5.firebasestorage.app",
  messagingSenderId: "152901594945",
  appId: "1:152901594945:web:a672dd14fe231a89bebbc0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function logoutAndReturnHome() {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  }).catch(() => {
    window.location.href = "index.html";
  });
}


document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const selectedRole = document.getElementById("roleSelect").value;
    const message = document.getElementById("message");

    if (!selectedRole) {
      message.textContent = "❌ Pilih peran Anda terlebih dahulu!";
      message.style.color = "red";
      return;
    }

    message.textContent = "⏳ Memproses...";
    message.style.color = "gray";

    try {
      await setPersistence(auth, browserLocalPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        logoutAndReturnHome();
        message.textContent = "❌ Data pengguna tidak ditemukan di database.";
        message.style.color = "red";
        return;
      }

      let userData = userDoc.data();

console.log("🔍 Data user:", userData);

      // Ambil info tambahan dari koleksi "guru" bila relevan
      if (["guru", "wali_kelas", "petugas_absen"].includes(selectedRole) && userData.nip) {
        const guruQuery = query(collection(db, "guru"), where("nip", "==", userData.nip));
        const guruSnapshot = await getDocs(guruQuery);
        if (!guruSnapshot.empty) {
          const guruData = guruSnapshot.docs[0].data();
          if (guruData.wali_kelas_dari) {
            userData.kelasWali = guruData.wali_kelas_dari;
          }
        }
      }

      // ** PERBAIKAN: Normalisasi Role untuk Perbandingan yang Aman **
      const userRoleNormalized = userData.role ? userData.role.toLowerCase().trim() : '';
      const selectedRoleKey = selectedRole; 

      // Tambahkan log supaya kita tahu nilai sebenarnya
console.log("🎯 selectedRole:", selectedRoleKey);
console.log("🎯 userRoleDB:", userData.role);
console.log("🎯 userRoleNormalized (DB):", userRoleNormalized); // LOG BARU KRUSIAL
console.log("🎯 kelas:", userData.kelas);


const allowedRoles = {
  admin: ["admin"],
  kepsek: ["kepsek"],
  wali_kelas: ["guru", "wali_kelas"],
  guru: ["guru"],
  petugas_absen: ["guru"],
  // Gunakan string yang sudah dinormalisasi untuk perbandingan
  ketua_kelas: ["ketua_kelas", "siswa", "student"]
};

// Cek apakah role yang di-input (selectedRoleKey) punya izin untuk role di DB (userRoleNormalized)
const isRoleAllowed = allowedRoles[selectedRoleKey]?.includes(userRoleNormalized);

console.log("🔑 CEK 1. Role cocok di allowedRoles (Normalisasi):", isRoleAllowed); // LOG BARU KRUSIAL

// ======================================
//  🎟 BYPASS: SEMUA AKUN BOLEH MASUK
//  JIKA MEMILIH ROLE "UMUM"
// ======================================
if (selectedRoleKey === "umum") {
  console.log("Bypass role check untuk akses Umum");
  
  message.textContent = "Login berhasil! Mengalihkan...";
  message.style.color = "green";

  setTimeout(() => {
    window.location.href = "inputpelanggaran.html";
  }, 800);

  return;
}


// Jika role TIDAK cocok (isRoleAllowed = false)
if (!isRoleAllowed) {
  // 🔹 Cek Pengecualian Khusus untuk Ketua Kelas
  const isKetuaKelasExceptionMet = (selectedRoleKey === "ketua_kelas" && userData.kelas && typeof userData.kelas === "string" && userData.kelas.trim() !== "");
  
  console.log("🔑 CEK 2. Pengecualian Ketua Kelas terpenuhi (punya data kelas):", isKetuaKelasExceptionMet); // LOG BARU KRUSIAL

  if (isKetuaKelasExceptionMet) {
    console.log("✅ Ketua kelas diizinkan karena ada data kelas:", userData.kelas);
  } else {
    // ❌ BLOK PENOLAKAN
    message.textContent = `❌ Akses Ditolak. Ini bukan akun ${selectedRole}.`;
    message.style.color = "red";
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1500);
    return;
  }
}


      message.textContent = "✅ Login berhasil! Mengalihkan...";
      message.style.color = "green";

      localStorage.setItem("userData", JSON.stringify(userData));

      setTimeout(() => {
        let redirectUrl = "";

       switch (selectedRoleKey) {
    case "admin":
      redirectUrl = "dashboard_admin.html";
      break;
    case "kepsek":
      redirectUrl = "dashboard_kepsek.html";
      break;
    case "wali_kelas":
      redirectUrl = "dashboard_wali_kelas.html";
      break;
    case "guru":
      redirectUrl = "dashboard_guru.html";
      break;
    case "petugas_absen":
      redirectUrl = "absensi_kelas.html";
      break;
      case "umum":
  redirectUrl = "inputpelanggaran.html";
  break;
    case "ketua_kelas": { // BLOK INI SUDAH DIPERBAIKI LOGIKANYA
      const isKetuaKelasData = userData.kelas || userData.kelasWali;
      if (isKetuaKelasData && typeof isKetuaKelasData === "string" && isKetuaKelasData.trim() !== "") {
        console.log("✅ Ketua kelas ditemukan, kelas:", isKetuaKelasData);
        redirectUrl = "input_keterangan.html";
        break; 
      } else {
        console.warn("⚠️ Data kelas ketua kelas tidak terdeteksi:", userData);
        
        message.textContent = "❌ Akses Ditolak. Data Ketua Kelas tidak ditemukan di sistem. Hubungi Admin.";
        message.style.color = "red";

        setTimeout(() => {
          logoutAndReturnHome(); 
        }, 1500);
        return;
      }
    }

    default:
      alert("Role tidak valid atau belum terdefinisi!");
      window.location.reload();
      return;
  }

  setTimeout(() => {
  window.location.href = redirectUrl;
}, 800); // beri jeda 0.8 detik agar Firebase Auth tersimpan dulu

}, 1000);

    } catch (error) {
      console.error("Login Error:", error);
      let errorMsg = "Login gagal. Cek email dan password Anda.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMsg = "Email atau Password salah.";
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = "Format Email tidak valid.";
      }
      message.textContent = `❌ ${errorMsg}`;
      message.style.color = "red";
    }
  }); // Penutup addEventListener("submit")
}); // Penutup document.addEventListener("DOMContentLoaded")