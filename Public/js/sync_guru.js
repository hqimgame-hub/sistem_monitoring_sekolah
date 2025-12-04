// === js/sync_guru.js ===
// Jalankan sekali untuk sinkronisasi data guru (langsung dari browser)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  getDocs,
  collection,
  doc,
  updateDoc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔹 Inisialisasi ulang Firebase secara lokal di sini
const firebaseConfig = {
  apiKey: "AIzaSyAXg6GUd0Aw1Ku0DmWKN0VNGgrbluO26i8",
  authDomain: "sistem-sekolah-6a1d5.firebaseapp.com",
  projectId: "sistem-sekolah-6a1d5",
  storageBucket: "sistem-sekolah-6a1d5.firebasestorage.app",
  messagingSenderId: "152901594945",
  appId: "1:152901594945:web:a672dd14fe231a89bebbc0"
};

// Inisialisasi Firebase App & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

(async () => {
  console.log("🚀 Memulai sinkronisasi guru dari koleksi 'users'...");

  try {
    const snapshot = await getDocs(collection(db, "users"));
    let total = 0;
    let sukses = 0;

    for (const d of snapshot.docs) {
      const u = d.data();
      if (u.role === "guru" || u.role === "kepsek") {
        total++;

        const kelasDiajar =
          u.kelasDiajar && u.kelasDiajar.length
            ? u.kelasDiajar
            : u.kelasWali
            ? [u.kelasWali]
            : [];

        // Update koleksi 'users'
        await updateDoc(doc(db, "users", d.id), { kelasDiajar });

        // Update / buat di 'guru'
        const guruRef = doc(db, "guru", d.id);
        const guruSnap = await getDoc(guruRef);

        const guruData = {
          uid: u.uid || d.id,
          nama: u.nama || "-",
          email: u.email || "-",
          role: u.role,
          mapel: u.mapel || [],
          kelasDiajar,
          waliKelas: u.waliKelas || false,
          kelasWali: u.kelasWali || "",
          dibuatPada: u.dibuatPada || new Date().toISOString(),
          disinkronkanPada: new Date().toISOString()
        };

        if (guruSnap.exists()) {
          await updateDoc(guruRef, guruData);
        } else {
          await setDoc(guruRef, guruData);
        }

        console.log(`✅ ${u.nama || "(Tanpa Nama)"} → ${kelasDiajar.join(", ") || "-"}`);
        sukses++;
      }
    }

    console.log(`🎯 Sinkronisasi selesai untuk ${sukses}/${total} guru.`);
  } catch (err) {
    console.error("❌ Gagal sinkronisasi:", err);
  }
})();
