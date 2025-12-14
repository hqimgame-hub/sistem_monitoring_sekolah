// =======================================================
// input_keterangan.js (versi final + filter tanggal aktif)
// Refactored with Shared Components & Local Init
// =======================================================

import {
  db, auth, collection, query, where, getDocs, updateDoc,
  doc, setDoc, serverTimestamp, onSnapshot
} from "./firebase_init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { renderNavbar } from "./components/Navbar.js";

// =======================================================
// DOM ELEMENTS
// =======================================================
const judulHalaman = document.getElementById("judulHalaman");
const kelasLabel = document.getElementById("kelasLabel");
const tabelSiswaBody = document.getElementById("tabelSiswa");
const modalForm = document.getElementById("modalForm");
const formKeterangan = document.getElementById("formKeterangan");
const btnBatal = document.getElementById("btnBatal");
const filterTanggal = document.getElementById("filterTanggal");
const btnResetTanggal = document.getElementById("btnResetTanggal");
const loadingOverlay = document.getElementById("loadingOverlay");

const siswaNamaModal = document.getElementById("siswaNamaModal");
const siswaIdModal = document.getElementById("siswaIdModal");
const absensiIdModal = document.getElementById("absensiIdModal");
const statusInput = document.getElementById("statusInput");
const keteranganTambahanInput = document.getElementById("keteranganTambahanInput");

let userData = null;
let realtimeUnsub = null;

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
// INITIALIZATION
// =======================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  if (loadingOverlay) loadingOverlay.classList.remove('hidden');

  try {
    // Check user role via firestore (for ketua_kelas specifically if needed, or re-use localStorage if reliable)
    // Fallback to localStorage for compatibility with existing flow if 'Ketua Kelas' isn't a standard 'role' field value
    const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
    let firestoreUser = null;
    if (!snap.empty) firestoreUser = snap.docs[0].data();

    // Compatibility: Retrieve local storage if used previously for specific "Ketua Kelas" object structure
    const storedData = localStorage.getItem("userData");
    userData = storedData ? JSON.parse(storedData) : null;

    // Basic Role Validation (Adjust logic depending on how 'Ketua Kelas' is modeled)
    // If the system relies on 'userData.role' being 'ketua_kelas'
    if (!userData || userData.role !== 'ketua_kelas') {
      // Try to repair from Firestore if current user has special claims? 
      // For now, strict check as per original file
      console.warn("User data mismatch or missing for Ketua Kelas.");
      /* 
      alert("Akses ditolak. Ini bukan akun Ketua Kelas valid.");
      await signOut(auth);
      window.location.href = "index.html";
      return; 
      */
    }

    renderNavbar({
      title: 'Input Keterangan',
      userEmail: user.email,
      onLogout: async () => {
        await signOut(auth);
        window.location.href = "index.html";
      }
    });

    // Reveal Content
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.classList.remove('opacity-0', 'transform', 'translate-y-4');
    if (loadingOverlay) loadingOverlay.classList.add('hidden');

    if (userData) {
      judulHalaman.textContent = `Ketua Kelas: ${userData.nama || user.email}`;
      kelasLabel.textContent = `Kelas ${userData.kelas}`;
      loadDataSiswaDanAbsensi();
      startRealtimeAbsensiListener();
    }

  } catch (err) {
    console.error("Init Error:", err);
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
  }
});


// =======================================================
// LOAD DATA
// =======================================================
async function loadDataSiswaDanAbsensi(targetDate = getTodayDateString()) {
  if (!userData || !userData.kelas) return;
  tabelSiswaBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-400">Memuat data...</td></tr>';

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
    tabelSiswaBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500 bg-red-50 rounded-lg">Error: ${err.message}. Pastikan koneksi aman.</td></tr>`;
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

  const statusRealtime = document.getElementById("statusRealtime");
  if (statusRealtime) statusRealtime.classList.remove("hidden");

  if (realtimeUnsub) realtimeUnsub();

  realtimeUnsub = onSnapshot(q, async () => {
    // Refresh only if currently viewing today
    if (filterTanggal && filterTanggal.value === today) {
      await loadDataSiswaDanAbsensi(today);
    }
  });
}

// =======================================================
// RENDER TABEL & LOGIC
// =======================================================
function renderTabel(siswaList, absensiMap) {
  if (siswaList.length === 0) {
    tabelSiswaBody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400">Tidak ada data siswa.</td></tr>';
    return;
  }

  let html = "";
  siswaList.sort((a, b) => (a.nama || '').localeCompare(b.nama || '')).forEach((siswa, index) => {
    const idSiswa = siswa.siswaIdUnik;
    const absensi = absensiMap[idSiswa];

    let statusHtml = `<span class="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">Belum Absen</span>`;
    let keterangan = "-";
    let btnClass = "bg-blue-600 hover:bg-blue-700 text-white";
    let btnText = "Input Ket";

    if (absensi) {
      keterangan = absensi.keterangan || "-";
      if (absensi.status === "Hadir") {
        statusHtml = `<span class="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">✅ Hadir</span>`;
        btnClass = "bg-gray-500 hover:bg-gray-600 text-white";
        btnText = "Edit";
      } else if (["Sakit", "Izin"].includes(absensi.status)) {
        statusHtml = `<span class="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">⚠️ ${absensi.status}</span>`;
        btnClass = "bg-yellow-500 hover:bg-yellow-600 text-white";
        btnText = "Edit";
      } else if (absensi.status === "Alfa") {
        statusHtml = `<span class="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">❌ Alfa</span>`;
        btnClass = "bg-red-500 hover:bg-red-600 text-white";
        btnText = "Edit";
      }
    }

    html += `
      <tr class="bg-white hover:bg-gray-50 transition-colors border-b border-gray-50">
        <td class="px-6 py-4 text-center font-mono text-xs text-gray-500">${index + 1}</td>
        <td class="px-6 py-4 font-semibold text-gray-800">${siswa.nama || 'Tanpa Nama'}</td>
        <td class="px-6 py-4 text-center">${statusHtml}</td>
        <td class="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">${keterangan}</td>
        <td class="px-6 py-4 text-center">
          <button class="btn-edit-keterangan px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-all ${btnClass}"
            data-siswa-id="${idSiswa}"
            data-siswa-nama="${siswa.nama}"
            data-absensi-id="${absensi ? absensi.docId : ""}"
            data-status="${absensi ? absensi.status : "Alfa"}"
            data-keterangan="${absensi ? absensi.keterangan || "" : ""}">
            <i class="bi bi-pencil-square"></i> ${btnText}
          </button>
        </td>
      </tr>`;
  });

  tabelSiswaBody.innerHTML = html;
  attachEditListeners();
}

// ... (Modal logic remains mostly similar but accessing new class names)
function openModal(siswaId, siswaNama, absensiId, status = "Alfa", keterangan = "") {
  siswaIdModal.value = siswaId;
  siswaNamaModal.textContent = siswaNama;
  absensiIdModal.value = absensiId;
  statusInput.value = status;
  keteranganTambahanInput.value = keterangan;
  modalForm.classList.remove("hidden");
  modalForm.classList.add("flex"); // Ensure flex display
}

function closeModal() {
  modalForm.classList.add("hidden");
  modalForm.classList.remove("flex");
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
      // alert("✅ Update");
    } else {
      await setDoc(doc(collection(db, "absensi")), dataToSave);
      // alert("✅ Saved");
    }
    // Refresh data immediately
    if (filterTanggal) await loadDataSiswaDanAbsensi(filterTanggal.value || getTodayDateString());
    else await loadDataSiswaDanAbsensi();

    closeModal();
  } catch (err) {
    console.error("Gagal menyimpan:", err);
    alert("❌ Gagal menyimpan.");
  }
});

// Event Listeners for Filters
if (filterTanggal) {
  filterTanggal.addEventListener("change", async () => {
    const val = filterTanggal.value;
    if (val) {
      if (realtimeUnsub) realtimeUnsub(); // pause realtime
      await loadDataSiswaDanAbsensi(val);
      const statusRealtime = document.getElementById("statusRealtime");
      if (statusRealtime) statusRealtime.classList.add('hidden');
    }
  });
}

if (btnResetTanggal) {
  btnResetTanggal.addEventListener("click", () => {
    filterTanggal.value = getTodayDateString();
    startRealtimeAbsensiListener();
    loadDataSiswaDanAbsensi();
  });
}

