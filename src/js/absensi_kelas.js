// ===============================================
// ✅ Absensi Kelas - QR Scanner (Versi Final Waktu Server)
// ===============================================

// Import Firebase SDK & Utils
import { db, auth, collection, query, where, getDocs, getDoc, doc, addDoc, deleteDoc, serverTimestamp } from "./firebase_init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ===============================================
// 📦 Variabel & Elemen DOM
// ===============================================
const JAM_MASUK_GLOBAL = "06:30";
let streaming = false;
let userData = null;

const video = document.getElementById("kamera");
const canvas = document.getElementById("kanvas");
const hasilDiv = document.getElementById("hasil");
const loadingOverlay = document.getElementById("loadingOverlay");
const petugasLabel = document.getElementById("petugasLabel");
const btnLogout = document.getElementById("btnLogout");
const jsQR = window.jsQR;

// ===============================================
// 🕒 Fungsi Utilitas
// ===============================================
function getTodayDateString() {
  const date = new Date();
  return date.toISOString().split("T")[0];
}

function showLoading(show) {
  loadingOverlay.classList.toggle("hidden", !show);
}

// ===============================================
// 🕒 Update Waktu Server Real-Time (Hybrid Firestore + API)
// ===============================================
async function startServerClock() {
  const clockEl = document.getElementById("serverClock");
  if (!clockEl) return;

  async function getWaktuDariFirestore() {
    try {
      const tempRef = await addDoc(collection(db, "_tempClock"), {
        createdAt: serverTimestamp(),
      });
      let waktuServer = null;
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 400));
        const snap = await getDoc(tempRef);
        if (snap.exists() && snap.data().createdAt) {
          waktuServer = snap.data().createdAt.toDate();
          break;
        }
      }
      await deleteDoc(tempRef);
      return waktuServer;
    } catch {
      return null;
    }
  }

  async function getWaktuDariAPI() {
    try {
      const res = await fetch("https://worldtimeapi.org/api/timezone/Asia/Jakarta");
      const data = await res.json();
      return new Date(data.datetime);
    } catch {
      return null;
    }
  }

  async function updateClock() {
    try {
      // 1️⃣ Coba ambil dari Firestore
      let waktuServer = await Promise.race([
        getWaktuDariFirestore(),
        new Promise((r) => setTimeout(() => r(null), 2000)), // timeout 2 detik
      ]);

      // 2️⃣ Jika gagal, fallback ke API publik
      if (!waktuServer) {
        waktuServer = await getWaktuDariAPI();
      }

      if (!waktuServer) {
        clockEl.textContent = "⚠️ Tidak bisa sinkron waktu server";
        clockEl.style.color = "gray";
        return;
      }

      // ✅ Tampilkan hasil
      const jam = waktuServer.toLocaleTimeString("id-ID", { hour12: false });
      const [jamMasuk, menitMasuk] = JAM_MASUK_GLOBAL.split(":").map(Number);
      const batas = new Date(waktuServer);
      batas.setHours(jamMasuk, menitMasuk, 0, 0);
      const terlambat = waktuServer > batas;

      clockEl.textContent = `🕒 Waktu Server: ${jam} WIB ${terlambat ? "(lewat batas)" : "(sinkron)"}`;
      clockEl.style.color = terlambat ? "red" : "green";
    } catch (err) {
      console.error("Clock hybrid error:", err);
      clockEl.textContent = "⚠️ Gagal ambil waktu server";
      clockEl.style.color = "gray";
    }
  }

  updateClock();
  setInterval(updateClock, 60000);
}

// ===============================================
// 🎥 QR Scanner
// ===============================================
function startKamera() {
  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" } })
    .then((stream) => {
      video.srcObject = stream;
      video.setAttribute("playsinline", true);
      video.play();
      streaming = true;
      requestAnimationFrame(tick);
    })
    .catch((err) => {
      hasilDiv.innerHTML = `<span class="text-red-600">❌ Gagal mengakses kamera: ${err.message}</span>`;
      streaming = false;
    });
}

function tick() {
  if (!streaming) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.height = video.videoHeight;
    canvas.width = video.videoWidth;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.data) {
      streaming = false;
      prosesScan(code.data.trim());
    }
  }

  if (streaming) requestAnimationFrame(tick);
}

// ===============================================
// 📋 Proses Data QR - waktu dari server asli
// ===============================================
async function prosesScan(qrData) {
  showLoading(true);

  const idSiswa = qrData.startsWith("SISWA_")
    ? qrData.split("_")[1]
    : qrData;

  try {
    const snap = await getDoc(doc(db, "siswa", idSiswa));
    if (!snap.exists()) {
      hasilDiv.innerHTML = "❌ QR Code tidak terdaftar sebagai siswa.";
      return;
    }

    const dataSiswa = snap.data();
    const todayString = getTodayDateString();

    const qCheck = query(
      collection(db, "absensi"),
      where("id_siswa", "==", idSiswa),
      where("tanggal_string", "==", todayString)
    );
    const snapCheck = await getDocs(qCheck);
    if (!snapCheck.empty) {
      const dataAbsenLama = snapCheck.docs[0].data();
      const waktuAbsenLama = dataAbsenLama.waktu.toDate().toLocaleTimeString("id-ID");
      hasilDiv.innerHTML = `
        ❌ <span class="text-red-600">${dataSiswa.nama}</span> sudah absen hari ini.<br>
        Status: ${dataAbsenLama.status} (${dataAbsenLama.keterangan})<br>
        <small class="text-gray-500">Scan: ${waktuAbsenLama}</small>
      `;
      hasilDiv.className = "mt-6 text-center text-red-700 p-3 bg-red-100 rounded-lg shadow";
      return;
    }

    // Ambil waktu server Firestore sungguhan
    const tempRef = await addDoc(collection(db, "_tempTime"), {
      createdAt: serverTimestamp(),
    });

    let waktuServer = null;
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const snapTime = await getDoc(tempRef);
      if (snapTime.exists() && snapTime.data().createdAt) {
        waktuServer = snapTime.data().createdAt.toDate();
        break;
      }
    }

    if (!waktuServer) {
      hasilDiv.innerHTML = "⚠️ Tidak bisa sinkron dengan waktu server.";
      return;
    }

    await deleteDoc(tempRef);

    // Bandingkan dengan batas jam masuk
    const [jamMasuk, menitMasuk] = JAM_MASUK_GLOBAL.split(":").map(Number);
    const batasMasuk = new Date(waktuServer);
    batasMasuk.setHours(jamMasuk, menitMasuk, 0, 0);
    const terlambat = waktuServer > batasMasuk;

    // Simpan absensi final
    await addDoc(collection(db, "absensi"), {
      id_siswa: idSiswa,
      nama: dataSiswa.nama,
      kelas: dataSiswa.kelas,
      waktu: serverTimestamp(),
      //tanggal_string: todayString,
      status: "Hadir",
      keterangan: terlambat ? "Terlambat" : "Tepat waktu",
      petugas: userData ? userData.nama : "Unknown",
    });

    hasilDiv.innerHTML = `
      ✅ <span class="text-green-600">${dataSiswa.nama}</span><br>
      Kelas: ${dataSiswa.kelas}<br>
      <span class="${terlambat ? "text-red-600" : "text-green-600"} font-semibold">
        ${terlambat ? "🚨 Terlambat" : "⏰ Tepat waktu"}
      </span><br>
      <small class="text-gray-500">${waktuServer.toLocaleTimeString("id-ID")}</small>
    `;
    hasilDiv.className = "mt-6 text-center text-green-700 p-3 bg-green-100 rounded-lg shadow";

  } catch (err) {
    console.error("Error scan:", err);
    hasilDiv.innerHTML = "❌ Terjadi kesalahan saat menyimpan absensi.";
    hasilDiv.className = "mt-6 text-center text-red-700 p-3 bg-red-100 rounded-lg shadow";
  } finally {
    showLoading(false);
    setTimeout(() => {
      if (!streaming) {
        streaming = true;
        hasilDiv.textContent = "Menunggu scan...";
        hasilDiv.className = "mt-6 text-center text-gray-700 p-3 bg-white rounded-lg shadow";
        requestAnimationFrame(tick);
      }
    }, 2000);
  }
}

// ===============================================
// 🔐 Login & Role Validation
// ===============================================
function initializeScanner() {
  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      alert("Akun tidak ditemukan di database.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    userData = userDoc.data();

    const roles = userData.roles || [];
    const isAdmin = userData.role === "admin";
    const isGuruPiket = userData.role === "guru" && roles.includes("piket");

    if (!isAdmin && !isGuruPiket) {
      alert("Akses ditolak! Hanya petugas piket atau admin yang boleh mengakses halaman ini.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    const roleDisplay = isAdmin ? "Admin" : `Guru (${roles.join(", ")})`;
    petugasLabel.textContent = `Petugas: ${userData.nama} - ${roleDisplay}`;
    btnLogout.classList.remove("hidden");

    startServerClock(); // jalankan jam server real-time
    startKamera();
  });
}

window.addEventListener("DOMContentLoaded", initializeScanner);
