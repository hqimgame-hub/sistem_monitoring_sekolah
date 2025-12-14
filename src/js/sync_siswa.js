import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, getDocs, collection, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAXg6GUd0Aw1Ku0DmWKN0VNGgrbluO26i8",
  authDomain: "sistem-sekolah-6a1d5.firebaseapp.com",
  projectId: "sistem-sekolah-6a1d5",
  storageBucket: "sistem-sekolah-6a1d5.firebasestorage.app",
  messagingSenderId: "152901594945",
  appId: "1:152901594945:web:a672dd14fe231a89bebbc0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function syncDataSiswa() {
  console.log("🚀 Memulai sinkronisasi data siswa...");
  const snap = await getDocs(collection(db, "siswa"));
  let totalDiperbarui = 0;
  let totalLewat = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const ref = doc(db, "siswa", d.id);
    const updateObj = {};

    // Kelas
    if (!data.kelas || typeof data.kelas !== "string") {
      console.warn(`⚠️ Siswa ${data.nama} tidak punya kelas`);
      continue;
    } else {
      updateObj.kelas = data.kelas.trim().toUpperCase();
    }

    // Total Poin
    if (typeof data.totalPoin !== "number") updateObj.totalPoin = 0;

    // Status
    if (!data.status) updateObj.status = "Aman";

    // Tanggal
    if (!data.created_at) updateObj.created_at = new Date().toISOString();

    // Update jika ada perubahan
    if (Object.keys(updateObj).length > 0) {
      await updateDoc(ref, updateObj);
      totalDiperbarui++;
    } else {
      totalLewat++;
    }
  }

  console.log(`✅ Sinkronisasi selesai! ${totalDiperbarui} siswa diperbarui, ${totalLewat} sudah lengkap.`);
  alert(`Sinkronisasi selesai!\n${totalDiperbarui} siswa diperbarui,\n${totalLewat} sudah lengkap.`);
}

// Jalankan otomatis saat dibuka
syncDataSiswa();
