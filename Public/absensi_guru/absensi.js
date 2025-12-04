// =================== ABSENSI QR DENGAN ERROR HANDLING ===================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, getDoc, getDocs, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { firebaseConfig } from "../js/firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const readerElem = document.getElementById("reader");
const resultElem = document.getElementById("result");
const errorElem = document.getElementById("errorMsg");

async function initScanner() {
  try {
    const scanner = new Html5Qrcode("reader");

    // 🔍 Cek kamera tersedia
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras || cameras.length === 0) {
      throw new Error("Tidak ada kamera terdeteksi. Pastikan kamera tersambung atau izinkan akses kamera.");
    }

    const cameraId = cameras[0].id; // gunakan kamera pertama

    await scanner.start(
      cameraId,
      { fps: 10, qrbox: 250 },
      async (decodedText) => {
        resultElem.textContent = "";
        errorElem.textContent = "";

        if (!decodedText.startsWith("ATTEND:")) {
          resultElem.innerHTML = "❌ QR tidak valid.";
          return;
        }

        const uid = decodedText.split(":")[1];
        const docRef = doc(db, "users", uid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          resultElem.innerHTML = "❌ Data pengguna tidak ditemukan.";
          return;
        }

        const data = snap.data();
        const now = new Date();
        const tanggal = now.toLocaleDateString("id-ID");
        const jam = now.toLocaleTimeString("id-ID");

        // 🕒 Status otomatis
        const jamMenit = now.getHours() * 60 + now.getMinutes();
        let status = "hadir";
        if (jamMenit > 435 && jamMenit <= 480) status = "telat";
        else if (jamMenit > 480) status = "terlambat";

        // 🔍 Cek apakah sudah absen hari ini
        const q = query(
          collection(db, "presensi"),
          where("uid", "==", uid),
          where("tanggal", "==", tanggal)
        );
        const existing = await getDocs(q);
        if (!existing.empty) {
          resultElem.innerHTML = `⚠️ ${data.nama} sudah tercatat hadir hari ini.`;
          return;
        }

        // 💾 Simpan data kehadiran
        await addDoc(collection(db, "presensi"), {
          uid,
          nama: data.nama,
          kelas: data.kelas || "-",
          role: data.role || "siswa",
          tanggal,
          jamMasuk: jam,
          status,
          lokasi: "Gerbang Utama",
          device: navigator.userAgent,
          createdAt: serverTimestamp()
        });

        resultElem.innerHTML = `✅ ${data.nama} (${data.kelas}) tercatat <b>${status.toUpperCase()}</b> jam ${jam}`;
      },
      (error) => {
        // Gagal membaca QR
        if (error.includes("NotFound")) return; // Abaikan error kamera normal
        console.warn("Scan error:", error);
      }
    );
  } catch (err) {
    console.error(err);
    errorElem.innerHTML = `
      ⚠️ <b>Gagal mengakses kamera.</b><br>
      ${err.message}<br>
      <small>Pastikan Anda membuka halaman ini melalui <b>Live Server / localhost / HTTPS</b> dan sudah memberi izin kamera.</small>
    `;
  }
}

// 🚀 Jalankan scanner
initScanner();
