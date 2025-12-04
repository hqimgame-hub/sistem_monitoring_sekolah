// =======================================================
// input_keterangan.js (versi final + filter tanggal aktif)
// =======================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// =======================================================
// Firebase Config
// =======================================================
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

let userData = null;
let realtimeUnsub = null; // untuk menonaktifkan listener saat filter aktif

// =======================================================
// UTILITIES
// =======================================================
function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

function getDayRange(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  return { start, end };
}

// =======================================================
// DOM ELEMENTS
// =======================================================
const judulHalaman = document.getElementById("judulHalaman");
const kelasLabel = document.getElementById("kelasLabel");
const btnLogout = document.getElementById("btnLogout");
const tabelSiswaBody = document.getElementById("tabelSiswa");
const modalForm = document.getElementById("modalForm");
const formKeterangan = document.getElementById("formKeterangan");
const btnBatal = document.getElementById("btnBatal");
const filterTanggal = document.getElementById("filterTanggal"); // ⚙️ Tambahan

const siswaNamaModal = document.getElementById("siswaNamaModal");
const siswaIdModal = document.getElementById("siswaIdModal");
const absensiIdModal = document.getElementById("absensiIdModal");
const statusInput = document.getElementById("statusInput");
const keteranganTambahanInput = document.getElementById("keteranganTambahanInput");

// =======================================================
// LOAD DATA
// =======================================================
async function loadDataSiswaDanAbsensi(targetDate = getTodayDateString()) {
  if (!userData || userData.role !== "ketua_kelas") return;
  tabelSiswaBody.innerHTML = '<tr><td colspan="6" class="p-4 text-gray-500">Memuat data...</td></tr>';

  try {
    // siswa di kelas ketua
    const qSiswa = query(collection(db, "siswa"), where("kelas", "==", userData.kelas));
    const siswaSnap = await getDocs(qSiswa);
    const siswaList = siswaSnap.docs.map(doc => ({
      ...doc.data(),
      siswaIdUnik: doc.data().id_siswa || doc.id
    }));

    // ambil absensi di rentang hari target
    const { start, end } = getDayRange(targetDate);
    const qAbsensi = query(
      collection(db, "absensi"),
      where("kelas", "==", userData.kelas),
      where("waktu", ">=", start),
      where("waktu", "<=", end)
    );
    const absensiSnap = await getDocs(qAbsensi);

    const absensiMap = {};
    absensiSnap.docs.forEach(doc => {
      const data = doc.data();
      absensiMap[data.id_siswa] = { ...data, docId: doc.id };
    });

    renderTabel(siswaList, absensiMap);
  } catch (err) {
    console.error("Gagal memuat data:", err);
    tabelSiswaBody.innerHTML = `<tr><td colspan="6" class="p-4 text-red-500">Error: ${err.message}</td></tr>`;
  }
}

// =======================================================
// REALTIME LISTENER
// =======================================================
function startRealtimeAbsensiListener() {
  if (!userData) return;

  const today = getTodayDateString();
  const { start, end } = getDayRange(today);

  const q = query(
    collection(db, "absensi"),
    where("kelas", "==", userData.kelas),
    where("waktu", ">=", start),
    where("waktu", "<=", end)
  );

  console.log("📡 Realtime listener aktif:", userData.kelas);

  const statusRealtime = document.getElementById("statusRealtime");
  if (statusRealtime) statusRealtime.classList.remove("hidden");

  // hentikan listener lama jika ada
  if (realtimeUnsub) realtimeUnsub();

  realtimeUnsub = onSnapshot(q, async () => {
    if (statusRealtime) {
      statusRealtime.textContent = `🟢 Data realtime aktif (${new Date().toLocaleTimeString("id-ID")})`;
    }
    await loadDataSiswaDanAbsensi(today);
  });
}

// =======================================================
// FILTER TANGGAL (⚙️ BAGIAN BARU)
// =======================================================
async function filterTanggalAbsensi() {
  if (!filterTanggal.value) {
    alert("Pilih tanggal terlebih dahulu!");
    return;
  }
filterTanggal.value = getTodayDateString(); // ⚙️ set default hari ini

  const selected = filterTanggal.value;
  console.log("📅 Filter absensi tanggal:", selected);

  // matikan realtime saat lihat tanggal lain
  if (realtimeUnsub) realtimeUnsub();

  await loadDataSiswaDanAbsensi(selected);
}

// =======================================================
// RENDER TABEL, MODAL, UPDATE, LOGOUT (tidak berubah)
// =======================================================
function renderTabel(siswaList, absensiMap) {
  if (siswaList.length === 0) {
    tabelSiswaBody.innerHTML = '<tr><td colspan="5" class="p-4 text-gray-500">Tidak ada data siswa.</td></tr>';
    return;
  }

  let html = "";
  siswaList.sort((a, b) => a.nama.localeCompare(b.nama)).forEach((siswa, index) => {
    const idSiswa = siswa.siswaIdUnik;
    const absensi = absensiMap[idSiswa];

    let status = "Belum Absen";
    let keterangan = "-";
    let actionBtnText = "Input Keterangan";
    let actionBtnClass = "bg-blue-500 hover:bg-blue-600";

    if (absensi) {
      status = absensi.status;
      keterangan = absensi.keterangan || "-";
      if (status === "Hadir") {
        status = `<span class="font-semibold text-green-600">Hadir (${absensi.keterangan})</span>`;
        actionBtnText = "Lihat/Edit";
        actionBtnClass = "bg-gray-500 hover:bg-gray-600";
      } else if (["Sakit", "Izin"].includes(absensi.status)) {
        status = `<span class="font-semibold text-orange-600">${absensi.status}</span>`;
        actionBtnClass = "bg-yellow-500 hover:bg-yellow-600";
      } else if (absensi.status === "Alfa") {
        status = `<span class="font-semibold text-red-600">${absensi.status}</span>`;
        actionBtnClass = "bg-red-500 hover:bg-red-600";
      }
    }

    html += `
      <tr>
        <td class="p-2">${index + 1}</td>
        <td class="p-2 text-left">${siswa.nama}</td>
        <td class="p-2">${status}</td>
        <td class="p-2">${keterangan}</td>
        <td class="p-2">
          <button class="btn-edit-keterangan text-white text-sm px-3 py-1 rounded ${actionBtnClass}"
            data-siswa-id="${idSiswa}"
            data-siswa-nama="${siswa.nama}"
            data-absensi-id="${absensi ? absensi.docId : ""}"
            data-status="${absensi ? absensi.status : "Alfa"}"
            data-keterangan="${absensi ? absensi.keterangan || "" : ""}">
            ${actionBtnText}
          </button>
        </td>
      </tr>`;
  });

  tabelSiswaBody.innerHTML = html;
  attachEditListeners();
}

function openModal(siswaId, siswaNama, absensiId, status = "Alfa", keterangan = "") {
  siswaIdModal.value = siswaId;
  siswaNamaModal.textContent = siswaNama;
  absensiIdModal.value = absensiId;
  statusInput.value = status;
  keteranganTambahanInput.value = keterangan;
  modalForm.classList.remove("hidden");
}

function closeModal() {
  modalForm.classList.add("hidden");
  formKeterangan.reset();
}

function attachEditListeners() {
  document.querySelectorAll(".btn-edit-keterangan").forEach(button => {
    button.addEventListener("click", (e) => {
      const btn = e.currentTarget;
      openModal(
        btn.dataset.siswaId,
        btn.dataset.siswaNama,
        btn.dataset.absensiId,
        btn.dataset.status,
        btn.dataset.keterangan
      );
    });
  });
  btnBatal.addEventListener("click", closeModal);
}

formKeterangan.addEventListener("submit", async (e) => {
  e.preventDefault();

  const siswaId = siswaIdModal.value;
  const absensiId = absensiIdModal.value;
  const newStatus = statusInput.value;
  const newKeterangan = keteranganTambahanInput.value.trim() || `Dikonfirmasi Ketua Kelas (${newStatus})`;

  const dataToSave = {
    id_siswa: siswaId,
    nama: siswaNamaModal.textContent,
    kelas: userData.kelas,
    status: newStatus,
    keterangan: newKeterangan,
    sumber: "Ketua_Kelas",
    waktu: serverTimestamp(),
    waktu_update: serverTimestamp(),
  };

  try {
    if (absensiId) {
      await updateDoc(doc(db, "absensi", absensiId), dataToSave);
      alert("✅ Keterangan siswa berhasil diubah.");
    } else {
      await setDoc(doc(collection(db, "absensi")), dataToSave);
      alert("✅ Keterangan siswa baru berhasil ditambahkan.");
    }
    closeModal();
  } catch (err) {
    console.error("Gagal menyimpan:", err);
    alert("❌ Gagal menyimpan: " + err.message);
  }
});

// =======================================================
// INISIALISASI (AUTENTIKASI DAN EVENT HANDLER)
// =======================================================
window.addEventListener("DOMContentLoaded", () => {
  const filterTanggal = document.getElementById("filterTanggal");
  const btnResetTanggal = document.getElementById("btnResetTanggal");

  // 🔹 Pantau status login
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    const storedData = localStorage.getItem("userData");
    if (!storedData) {
      alert("Data peran tidak ditemukan. Silakan login ulang.");
      signOut(auth).then(() => (window.location.href = "index.html"));
      return;
    }

    userData = JSON.parse(storedData);
    if (userData.role !== "ketua_kelas") {
      alert("Akses ditolak. Ini bukan akun Ketua Kelas.");
      signOut(auth).then(() => (window.location.href = "index.html"));
      return;
    }

    // 🔹 Tampilkan info akun
    judulHalaman.textContent = `Ketua Kelas: ${userData.nama}`;
    kelasLabel.textContent = `Kelas ${userData.kelas}`;

    // 🔹 Muat data awal & aktifkan realtime hari ini
    loadDataSiswaDanAbsensi();
    startRealtimeAbsensiListener();
  });

  // =======================================================
  // EVENT: FILTER TANGGAL MANUAL
  // =======================================================
  if (filterTanggal) {
    filterTanggal.addEventListener("change", async () => {
      const selectedDate = filterTanggal.value;
      if (!selectedDate) return;

      console.log("📅 Filter tanggal:", selectedDate);

      // Nonaktifkan realtime dulu
      const statusRealtime = document.getElementById("statusRealtime");
      if (statusRealtime) {
        statusRealtime.textContent = "⏸️ Mode filter tanggal non-realtime";
      }

      // Tampilkan data berdasarkan tanggal yang dipilih
      await loadDataSiswaDanAbsensi(selectedDate);
    });
  }

  // =======================================================
  // EVENT: TOMBOL "HARI INI"
  // =======================================================
  if (btnResetTanggal) {
    btnResetTanggal.addEventListener("click", () => {
      // Set tanggal kembali ke hari ini
      filterTanggal.value = getTodayDateString();

      // Aktifkan realtime lagi
      startRealtimeAbsensiListener();

      // Segera tampilkan data hari ini
      loadDataSiswaDanAbsensi(getTodayDateString());

      const statusRealtime = document.getElementById("statusRealtime");
      if (statusRealtime) {
        statusRealtime.textContent = "🟢 Realtime aktif (hari ini)";
      }

      console.log("🔄 Kembali ke realtime hari ini");
    });
  }

  // =======================================================
  // EVENT: LOGOUT
  // =======================================================
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        await signOut(auth);
        localStorage.removeItem("userData");
        window.location.href = "index.html";
      } catch {
        alert("Logout gagal");
      }
    });
  }
});

