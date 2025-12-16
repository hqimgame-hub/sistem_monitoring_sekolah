// dashboard_guru.js
// JS terpisah untuk Dashboard Guru v2

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDoc, getDocs, deleteDoc, doc, updateDoc,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";
import { renderNavbar } from "./components/Navbar.js";
import { renderSidebar } from "./components/Sidebar.js";

// -------------------- Firebase init --------------------
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

let currentUser = null;

// ===============================
// 🔹 Pagination State Management
// ===============================
const paginationState = {
  jurnal: { currentPage: 1, itemsPerPage: 10 },
  pelanggaran: { currentPage: 1, itemsPerPage: 10 },
  catatanKelas: { currentPage: 1, itemsPerPage: 10 }
};

// ===============================
// 🔹 Pagination Utility Function
// ===============================
function renderPagination(containerId, totalItems, currentPage, itemsPerPage, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '<div class="flex items-center justify-between gap-2">';

  // Info text
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  html += `<span class="text-sm text-gray-600">Menampilkan ${startItem}-${endItem} dari ${totalItems} data</span>`;

  html += '<div class="flex gap-1">';

  // Previous button
  html += `<button class="px-3 py-1 text-sm border rounded ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}" 
    ${currentPage === 1 ? 'disabled' : ''} onclick="window.paginationGoToPage('${containerId}', ${currentPage - 1})">
    <i class="bi bi-chevron-left"></i>
  </button>`;

  // Page numbers
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);

  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    html += `<button class="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-50" onclick="window.paginationGoToPage('${containerId}', 1)">1</button>`;
    if (startPage > 2) html += '<span class="px-2 py-1 text-sm">...</span>';
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="px-3 py-1 text-sm border rounded ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}" 
      onclick="window.paginationGoToPage('${containerId}', ${i})">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += '<span class="px-2 py-1 text-sm">...</span>';
    html += `<button class="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-50" onclick="window.paginationGoToPage('${containerId}', ${totalPages})">${totalPages}</button>`;
  }

  // Next button
  html += `<button class="px-3 py-1 text-sm border rounded ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}" 
    ${currentPage === totalPages ? 'disabled' : ''} onclick="window.paginationGoToPage('${containerId}', ${currentPage + 1})">
    <i class="bi bi-chevron-right"></i>
  </button>`;

  html += '</div></div>';
  container.innerHTML = html;
}

// Global pagination handler
window.paginationGoToPage = function (containerId, page) {
  const tableKey = containerId.replace('pag', '').toLowerCase();
  if (paginationState[tableKey]) {
    paginationState[tableKey].currentPage = page;
  }

  // Reload appropriate table
  if (containerId.includes('Jurnal')) loadJurnal();
  else if (containerId.includes('Pelanggaran')) loadCatatanPelanggaran();
  else if (containerId.includes('Catatan')) loadCatatanKelas();
};


// ===============================
// 🔹 Load data guru login dari Firestore (filter dropdown kelas & mapel)
// ===============================
async function loadGuruData() {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    console.warn("⚠️ Data guru tidak ditemukan di Firestore");
    return;
  }

  const data = snap.data();
  window.guruData = data;
  console.log("✅ Data guru login:", data);

  // ===============================
  // 🔹 Filter dropdown hanya sesuai guru
  // ===============================
  if (data.role === "guru") {
    // Semua dropdown KELAS di seluruh tab
    const selectKelas = document.querySelectorAll(`
      #kelas,
      #kelasInputSelect,
      #kelasSemesterSelect,
      #filterKelasNilai,
      #kelasKelas,
      #filterKelasCatatan,
      #kelasPelanggaran,
      #filterKelasPelanggaran
    `);

    // Semua dropdown MAPEL di seluruh tab
    const selectMapel = document.querySelectorAll(`
      #mapel,
      #mapelInputSelect,
      #mapelInputSAS,
      #filterMapelNilai,
      #mapelRekapSelect
    `);

    // Kosongkan dropdown dulu
    selectKelas.forEach(sel => {
      if (!sel) return;
      sel.innerHTML = `<option value="">-- Pilih Kelas --</option>`;
    });

    selectMapel.forEach(sel => {
      if (!sel) return;
      sel.innerHTML = `<option value="">-- Pilih Mata Pelajaran --</option>`;
    });

    // Isi dropdown kelas sesuai Firestore
    (data.kelasDiajar || []).forEach(k => {
      selectKelas.forEach(sel => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = k;
        sel.appendChild(opt);
      });
    });

    // Isi dropdown mapel sesuai Firestore
    (data.mapel || []).forEach(m => {
      selectMapel.forEach(sel => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        sel.appendChild(opt);
      });
    });

    console.log("✅ Dropdown guru difilter:", {
      kelasDiajar: data.kelasDiajar,
      mapel: data.mapel
    });
  }

  // Jika guru juga wali kelas → isi otomatis di form Isi Jurnal
  if (data.waliKelas && data.kelasWali) {
    const kelasEl = document.getElementById("kelas");
    if (kelasEl) kelasEl.value = data.kelasWali;
  }
  window.guruData = data;
}

// ============================
// INISIALISASI MODUL PELANGGARAN
// ============================
let pelanggaranModuleInitialized = false; // FLAG to prevent multiple initialization

async function initPelanggaranModule() {
  // Jika sudah diinisialisasi, jangan jalankan lagi!
  if (pelanggaranModuleInitialized) {
    console.log('⚠️ initPelanggaranModule: sudah diinisialisasi sebelumnya, skip.');
    return;
  }

  const kelasSel = document.getElementById('kelasPelanggaran');
  const siswaSel = document.getElementById('namaSiswaPelanggaran');
  const filterKelasSel = document.getElementById('filterKelasPelanggaran');
  const filterSiswaSel = document.getElementById('filterSiswaPelanggaran');
  const jenisSel = document.getElementById('jenisPelanggaran');
  const poinInput = document.getElementById('poinPelanggaran');

  if (!kelasSel || !siswaSel || !filterKelasSel || !filterSiswaSel || !jenisSel || !poinInput) {
    console.warn('initPelanggaranModule: elemen pelanggaran belum muncul.');
    return;
  }

  await loadJenisPelanggaran();  // sudah ada di file kamu

  // isi dropdown kelas (pakai kelasDiajar guru)
  if (window.guruData?.kelasDiajar) {
    kelasSel.innerHTML = `<option value="">-- Pilih Kelas --</option>`;
    filterKelasSel.innerHTML = `<option value="">-- Semua Kelas --</option>`;
    window.guruData.kelasDiajar.forEach(k => {
      kelasSel.appendChild(new Option(k, k));
      filterKelasSel.appendChild(new Option(k, k));
    });
  }

  // ambil siswa berdasarkan kelas
  kelasSel.addEventListener('change', async () => {
    const kelas = kelasSel.value;
    siswaSel.innerHTML = `<option value="">-- Pilih Siswa --</option>`;
    if (!kelas) return;

    const snap = await getDocs(query(collection(db, 'siswa'), where('kelas', '==', kelas)));

    // Sortir alfabetis
    const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    students.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));

    students.forEach(s => {
      siswaSel.appendChild(new Option(s.nama, s.id)); // VALUE = ID SISWA
    });
  });

  // filter: muat siswa
  filterKelasSel.addEventListener('change', async () => {
    filterSiswaSel.innerHTML = `<option value="">-- Semua Siswa --</option>`;
    const kelas = filterKelasSel.value;

    if (!kelas) {
      loadCatatanPelanggaran();
      return;
    }

    const snap = await getDocs(query(collection(db, 'siswa'), where('kelas', '==', kelas)));

    // Sortir alfabetis
    const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    students.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));

    students.forEach(s => {
      filterSiswaSel.appendChild(new Option(s.nama, s.id));
    });

    loadCatatanPelanggaran();
  });

  // auto kategori & poin
  jenisSel.addEventListener('change', async (e) => {
    const jenis = e.target.value;
    if (!poinInput) return;

    if (!jenis) {
      poinInput.value = 0;
      return;
    }

    try {
      const snap = await getDocs(collection(db, 'jenis_pelanggaran'));
      let poin = 0;

      snap.forEach(d => {
        const data = d.data();
        if (data.nama === jenis || data.jenis === jenis) {
          poin = data.poin || 0;
        }
      });

      poinInput.value = poin;

    } catch (err) {
      console.error('initPelanggaranModule: gagal ambil poin jenis pelanggaran', err);
      poinInput.value = 0;
    }
  });


  loadCatatanPelanggaran();

  // Set flag bahwa sudah diinisialisasi
  pelanggaranModuleInitialized = true;

  console.log('✅ initPelanggaranModule: selesai inisialisasi pelanggaran');
}

// Jalankan inisialisasi pelanggaran hanya saat menu pelanggaran diklik
document.getElementById('menuPelanggaran')?.addEventListener('click', async () => {
  const section = document.getElementById('sectionPelanggaran');
  if (!section) return;
  // Pastikan elemen dropdown sudah tersedia
  const kelasSel = document.getElementById('kelasPelanggaran');
  const siswaSel = document.getElementById('namaSiswaPelanggaran');
  if (!kelasSel || !siswaSel) {
    console.log('Elemen pelanggaran belum siap, tunggu 200ms...');
    // beri waktu sedikit untuk render di HP
    setTimeout(() => initPelanggaranModule(), 200);
  } else {
    await initPelanggaranModule();
  }
});

function isiDropdownKelas(kelasList) {
  const kelasSelects = document.querySelectorAll("#kelas, #kelasInputSelect, #kelasSemesterSelect");
  kelasSelects.forEach(select => {
    if (!select) return;
    select.innerHTML = '<option value="">-- Pilih Kelas --</option>';
    kelasList.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k;
      select.appendChild(opt);
    });
  });
}

auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("Guru login:", user.email);
    loadGuruData();
  } else {
    window.location.href = "login.html";
  }
});

// ==================================================
// Fungsi: Memuat daftar kelas dari koleksi "kelas"
// ==================================================
async function loadKelasDropdownGuru() {
  async function loadKelasDropdownGuru() {
    try {
      // 🧠 Cek dulu apakah guru sudah login & punya daftar kelas yang diajar
      if (window.guruData && window.guruData.role === "guru" && Array.isArray(window.guruData.kelasDiajar)) {
        const kelasList = window.guruData.kelasDiajar;
        const ids = [
          'kelasInputSelect',
          'kelasSemesterSelect',
          'filterKelasNilai',
          'kelas',
          'kelasKelas',
          'filterKelasCatatan',
          'kelasPelanggaran',
          'filterKelasPelanggaran'
        ];

        ids.forEach(id => {
          const select = document.getElementById(id);
          if (!select) return;
          select.innerHTML = `<option value="">${id.includes('filter') ? '-- Semua Kelas --' : '-- Pilih Kelas --'}</option>`;
          kelasList.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = k;
            select.appendChild(opt);
          });
        });

        console.log("✅ Dropdown kelas (filtered by guru) dimuat:", kelasList);
        return; // penting → hentikan agar tidak lanjut load semua kelas dari Firestore
      }

      // ⬇️ Jika tidak ada guruData, baru fallback ke Firestore seperti semula
      const snap = await getDocs(collection(db, "kelas"));
      const ids = [
        'kelasInputSelect',
        'kelasSemesterSelect',
        'filterKelasNilai',
        'kelas',
        'kelasKelas',
        'filterKelasCatatan',
        'kelasPelanggaran'
      ];

      ids.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = `<option value="">${id.includes('filter') ? '-- Semua Kelas --' : '-- Pilih Kelas --'}</option>`;
        snap.forEach(docSnap => {
          const data = docSnap.data();
          const name = data.namaKelas || data.name || "";
          if (!name) return;
          const opt = document.createElement("option");
          opt.value = name;
          opt.textContent = name;
          select.appendChild(opt);
        });
      });

      console.log("✅ Dropdown kelas (semua) berhasil dimuat ke semua menu guru");
    } catch (err) {
      console.error("❌ Gagal memuat kelas:", err);
    }
  }
}

// ========================= LOAD MAPEL UNTUK INPUT NILAI =========================
async function loadMapelDropdownInputNilai() {
  const mapelSelect = document.getElementById("mapelInputSelect");
  if (!mapelSelect) return;

  mapelSelect.innerHTML = `<option value="">⏳ Memuat daftar mapel...</option>`;

  try {
    const snap = await getDocs(collection(db, "mapel"));
    if (snap.empty) {
      mapelSelect.innerHTML = `<option value="">Belum ada data mapel</option>`;
      return;
    }

    mapelSelect.innerHTML = `<option value="">-- Pilih Mata Pelajaran --</option>`;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.nama) return;
      const opt = document.createElement("option");
      opt.value = data.nama;
      opt.textContent = data.nama;
      mapelSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("Gagal memuat mapel:", err);
    mapelSelect.innerHTML = `<option value="">Gagal memuat data mapel</option>`;
  }
}

// ========================= LOAD MAPEL UNTUK SEMUA TAB NILAI =========================
async function loadMapelDropdowns() {
  const mapelElements = [
    document.getElementById("mapelInputSelect"), // tab Nilai per Bab
    document.getElementById("mapelInputSAS"),    // tab Nilai SAS
    document.getElementById("mapelInputSAT"),    // tab Nilai SAT
    document.getElementById("mapelRekapSelect")
  ].filter(el => el); // hanya elemen yang ada

  mapelElements.forEach(el => {
    el.innerHTML = `<option value="">⏳ Memuat daftar mapel...</option>`;
  });

  try {
    const snap = await getDocs(collection(db, "mapel"));
    if (snap.empty) {
      mapelElements.forEach(el => {
        el.innerHTML = `<option value="">Belum ada data mapel</option>`;
      });
      return;
    }

    const options = [`<option value="">-- Pilih Mata Pelajaran --</option>`];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.nama) {
        options.push(`<option value="${data.nama}">${data.nama}</option>`);
      }
    });

    mapelElements.forEach(el => {
      el.innerHTML = options.join("");
    });
  } catch (err) {
    console.error("Gagal memuat daftar mapel:", err);
    mapelElements.forEach(el => {
      el.innerHTML = `<option value="">Gagal memuat data mapel</option>`;
    });
  }
}

// ==================================================
// Fungsi: Memuat daftar mapel dari koleksi "mapel"
// ==================================================
async function loadMapelDropdownGuru() {
  try {
    const snap = await getDocs(collection(db, "mapel"));
    const selectIds = [
      "mapel",                 // untuk form isi jurnal
      "mapelInputSelect",      // untuk input nilai bab
      "mapelSemesterSelect",   // untuk input nilai semester
      "filterMapelNilai",     // untuk rekap/filter nilai
      "mapelRekapSelect"
    ];

    selectIds.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = `<option value="">${id.includes('filter') ? '-- Semua Mapel --' : '-- Pilih Mapel --'}</option>`;
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const nama = data.namaMapel || data.nama || data.mapel || "";
        if (!nama) return;
        const opt = document.createElement("option");
        opt.value = nama;
        opt.textContent = nama;
        sel.appendChild(opt);
      });
    });

    console.log("✅ Dropdown mapel berhasil dimuat ke semua menu guru");
  } catch (err) {
    console.error("❌ Gagal memuat mapel:", err);
  }
}



// -------------------- Auth & init --------------------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    // document.getElementById("userName").textContent = user.email; // Handled by Navbar

    console.log("🔑 Guru login:", user.email);

    // 1️⃣ Muat data guru dan filter dropdown
    await loadGuruData();

    // 2️⃣ Jalankan inisialisasi lain (tanpa load kelas/mapel global)
    await initGuruUI();

    // 3️⃣ Muat data awal
    await loadJurnal();
    await loadCatatanKelas();
    await initPelanggaranModule();

    console.log("✅ Semua modul guru siap digunakan");
  } else {
    window.location.href = "index.html";
  }
});

async function initGuruUI() {
  // 1. Render Navbar
  renderNavbar({
    title: 'Dashboard Guru',
    userEmail: currentUser ? currentUser.email : 'Guru',
    onLogout: async () => {
      await signOut(auth);
      window.location.href = "index.html";
    }
  });

  // 2. Render Sidebar
  renderSidebar([
    { id: 'btnMenuIsi', label: 'Isi Jurnal', icon: '<i class="bi bi-journal-text text-xl"></i>', onClick: () => showSection('sectionIsi') },
    { id: 'btnMenuDaftar', label: 'Daftar Jurnal', icon: '<i class="bi bi-list-ul text-xl"></i>', onClick: () => showSection('sectionDaftar') },
    { id: 'btnMenuInputNilai', label: 'Nilai Per Bab', icon: '<i class="bi bi-pencil-square text-xl"></i>', onClick: () => showSection('sectionInputNilai') },
    { id: 'btnMenuNilaiSemester', label: 'Nilai Semester/Tahun', icon: '<i class="bi bi-file-earmark-text text-xl"></i>', onClick: () => showSection('sectionNilaiSemester') },
    { id: 'btnMenuRekap', label: 'Rekap Nilai', icon: '<i class="bi bi-bar-chart text-xl"></i>', onClick: () => { showSection('sectionRekapNilai'); loadMapelDropdowns(); } },
    { id: 'btnMenuCatatan', label: 'Catatan Kelas', icon: '<i class="bi bi-journal-bookmark text-xl"></i>', onClick: () => showSection('sectionCatatan') },
    { id: 'btnMenuPelanggaran', label: 'Catatan Pelanggaran', icon: '<i class="bi bi-exclamation-octagon text-xl"></i>', onClick: () => showSection('sectionPelanggaran') },
  ]);

  // Default view
  showSection('sectionIsi');

  // Bind utilitas lain
  bindExportButtons();
  console.log("🧩 initGuruUI: UI guru siap (Shared Components).");
}

function showSection(sectionId) {
  const sections = ['sectionIsi', 'sectionDaftar', 'sectionInputNilai', 'sectionNilaiSemester', 'sectionRekapNilai', 'sectionCatatan', 'sectionPelanggaran'];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('active'); // jaga-jaga kalau ada sisa css lama
    }
  });

  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
}


document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.href = 'index.html'));

// -------------------- Navigasi Menu Lama Dihapus (Diganti Sidebar.js) --------------------


// -------------------- Seed UI (load kelas, jenis pelanggaran, bind exports) --------------------
async function seedUI() {
  await loadnamaKelas();
  //await loadKelasDropdownGuru();
  //  await loadMapelDropdownGuru();
  await loadMapelDropdownInputNilai();
  await loadMapelDropdowns();
  bindExportButtons();
  console.log("✅ UI guru siap digunakan");
  // hide absensi menu/section if exists
  const absensiMenu = document.getElementById('menuAbsensi'); if (absensiMenu) absensiMenu.remove();
  const absensiSection = document.getElementById('sectionAbsensi'); if (absensiSection) absensiSection.remove();
}

// -------------------- Load namaKelas dari koleksi namaKelas --------------------
async function loadnamaKelas() {
  try {
    const snap = await getDocs(collection(db, 'namaKelas'));
    const kelasList = snap.docs.map(d => (d.data().namaKelas));
    // target selects to populate
    const ids = ['kelasInputSelect', 'kelasSemesterSelect', 'filterKelasNilai', 'kelas', 'filterKelas'];
    ids.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '';
      const optDefault = document.createElement('option'); optDefault.value = ''; optDefault.textContent = id.includes('filter') ? 'Semua' : '-- Pilih Kelas --';
      sel.appendChild(optDefault);
      kelasList.forEach(k => {
        const o = document.createElement('option'); o.value = k; o.textContent = k; sel.appendChild(o);
      });
    });
  } catch (err) { console.error('loadnamaKelas:', err); }
}

// -------------------- Load jenis pelanggaran dari koleksi jenis_pelanggaran --------------------
async function loadJenisPelanggaran() {
  try {
    const sel = document.getElementById('jenisPelanggaran');
    if (!sel) return;
    sel.innerHTML = '';
    const snap = await getDocs(collection(db, 'jenis_pelanggaran'));
    const optDefault = document.createElement('option'); optDefault.value = ''; optDefault.textContent = '-- Pilih Jenis Pelanggaran --'; sel.appendChild(optDefault);
    snap.forEach(d => {
      const v = d.data().nama || d.data().jenis || d.id;
      const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o);
    });
  } catch (err) { console.error('loadJenisPelanggaran', err); }
}

// -------------------- EXPORT/UTILS --------------------
function bindExportButtons() {
  // === Tombol export untuk Daftar Jurnal (dari HTML) ===
  document.getElementById('exportJurnalExcel')?.addEventListener('click', exportJurnalToExcel);
  document.getElementById('exportJurnalPDF')?.addEventListener('click', exportJurnalPDFCustom);

  // === Tambahkan tombol export di bagian Rekap Nilai (jika belum ada) ===
  const rekapHeader = document.querySelector('#sectionRekapNilai .card-header');
  if (rekapHeader && !rekapHeader.querySelector('.export-rekap')) {
    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group export-rekap float-end';

    const btnExcel = document.createElement('button');
    btnExcel.className = 'btn btn-success btn-sm';
    btnExcel.innerHTML = '📗 Export Excel';
    btnExcel.addEventListener('click', () => exportTableToExcel('tabelRekapNilai', 'rekap_nilai'));

    const btnPDF = document.createElement('button');
    btnPDF.className = 'btn btn-danger btn-sm';
    btnPDF.innerHTML = '📕 Export PDF';
    btnPDF.addEventListener('click', () => printTable('tabelRekapNilai'));

    btnGroup.appendChild(btnExcel);
    btnGroup.appendChild(btnPDF);

    rekapHeader.appendChild(btnGroup);
  }
}

function exportJurnalToExcel() {
  const table = document.getElementById('tabelJurnal');
  if (!table) return alert('Tabel jurnal tidak ditemukan');
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Jurnal' });
  XLSX.writeFile(wb, 'jurnal.xlsx');
}

function exportTableToExcel(tableId, filename = 'export') {
  const table = document.getElementById(tableId);
  if (!table) return alert('Tabel tidak ditemukan');
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Sheet1' });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function printTable(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return alert('Tabel tidak ditemukan');
  const w = window.open('', '_blank');
  w.document.write('<html><head><title>Export PDF</title>');
  w.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">');
  w.document.write('</head><body>');
  w.document.write('<h4>Export</h4>');
  w.document.write(table.outerHTML);
  w.document.write('</body></html>');
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 500);
}

// -------------------- JURNAL (export already bound) --------------------
async function loadJurnal() {
  try {
    const snap = await getDocs(collection(db, 'jurnal'));
    const allData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Pagination
    const { currentPage, itemsPerPage } = paginationState.jurnal;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = allData.slice(startIndex, endIndex);

    const tbody = document.querySelector('#tabelJurnal tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (paginatedData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-gray-400">Tidak ada data jurnal</td></tr>';
      renderPagination('pagJurnal', allData.length, currentPage, itemsPerPage);
      return;
    }

    paginatedData.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50';
      tr.innerHTML = `
        <td class="px-4 py-3"><input type="checkbox" class="jurnal-checkbox rounded" data-id="${r.id}"></td>
        <td class="px-4 py-3">${r.tanggal || '-'}</td>
        <td class="px-4 py-3">${r.kelas || '-'}</td>
        <td class="px-4 py-3">${r.mapel || '-'}</td>
        <td class="px-4 py-3">${r.jamKe || '-'}</td>
        <td class="px-4 py-3">${r.kegiatan || '-'}</td>
        <td class="px-4 py-3">${r.tindakLanjut || '-'}</td>
        <td class="px-4 py-3">${r.siswaTidakMasuk || '-'}</td>
        <td class="px-4 py-3">
          <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs mr-1" data-id="${r.id}" onclick="(function(id){window._editJurnal(id)})('${r.id}')">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs" data-id="${r.id}" onclick="(function(id){window._hapusJurnal(id)})('${r.id}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>`;
      tbody.appendChild(tr);
    });

    // Render pagination controls
    renderPagination('pagJurnal', allData.length, currentPage, itemsPerPage);

  } catch (err) {
    console.error('loadJurnal', err);
  }
}

// Bulk delete for Jurnal
window.deleteSelectedJurnal = async function () {
  const checkboxes = document.querySelectorAll('.jurnal-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('Pilih minimal satu jurnal untuk dihapus');
    return;
  }

  if (!confirm(`Hapus ${checkboxes.length} jurnal yang dipilih?`)) return;

  try {
    for (const checkbox of checkboxes) {
      await deleteDoc(doc(db, 'jurnal', checkbox.dataset.id));
    }
    alert(`✅ ${checkboxes.length} jurnal berhasil dihapus`);
    loadJurnal();
  } catch (err) {
    console.error('Error deleting jurnal:', err);
    alert('Gagal menghapus jurnal: ' + err.message);
  }
};

// Select all jurnal
window.toggleSelectAllJurnal = function (checkbox) {
  const checkboxes = document.querySelectorAll('.jurnal-checkbox');
  checkboxes.forEach(cb => cb.checked = checkbox.checked);
};

// expose functions to window for inline onclicks
window._editJurnal = async function (id) {
  const snap = await getDocs(collection(db, 'jurnal'));
  const docu = snap.docs.find(d => d.id === id);
  if (!docu) return; const data = docu.data();
  document.getElementById('editId').value = id;
  document.getElementById('tanggal').value = data.tanggal || '';
  document.getElementById('kelas').value = data.kelas || '';
  document.getElementById('mapel').value = data.mapel || '';
  document.getElementById('jamKe').value = data.jamKe || '';
  document.getElementById('kegiatan').value = data.kegiatan || '';
  document.getElementById('tindakLanjut').value = data.tindakLanjut || '';
  document.getElementById('siswaTidakMasuk').value = data.siswaTidakMasuk || '';
  document.getElementById('menuIsi')?.click();
};
window._hapusJurnal = async function (id) { if (confirm('Hapus jurnal ini?')) { await deleteDoc(doc(db, 'jurnal', id)); loadJurnal(); } };

// -------------------- FORM ISI JURNAL (Tambah Jurnal Baru) --------------------
document.getElementById('formJurnal')?.addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    uid: currentUser?.uid || '',
    tanggal: document.getElementById('tanggal').value,
    kelas: document.getElementById('kelas').value,
    mapel: document.getElementById('mapel').value,
    jamKe: Array.from(document.querySelectorAll('input[name="jamKe"]:checked'))
      .map(cb => cb.value)
      .join(', '),
    kegiatan: document.getElementById('kegiatan').value,
    tindakLanjut: document.getElementById('tindakLanjut').value,
    siswaTidakMasuk: document.getElementById('siswaTidakMasuk').value,
    timestamp: serverTimestamp()
  };

  try {
    await addDoc(collection(db, 'jurnal'), data);
    alert('✅ Jurnal berhasil disimpan');
    e.target.reset();
    loadJurnal(); // reload tabel setelah simpan
  } catch (err) {
    console.error(err);
    alert('❌ Gagal menyimpan jurnal: ' + err.message);
  }
});


// -------------------- NILAI PER BAB (persist & load existing) --------------------
// When loading students, also load existing nilai_siswa for kelas/mapel/bab

document.getElementById('btnLoadSiswaNilai')?.addEventListener('click', async () => {
  const kelas = document.getElementById('kelasInputSelect').value;
  const mapel = document.getElementById('mapelInputSelect').value;
  const bab = document.getElementById('babSelect').value;
  if (!kelas || !mapel || !bab) {
    alert('Pilih kelas, mapel, dan bab terlebih dahulu');
    return;
  }

  console.log('🔍 Loading students for:', { kelas, mapel, bab });

  try {
    // fetch students
    const snapS = await getDocs(query(collection(db, 'siswa'), where('kelas', '==', kelas)));
    const students = snapS.docs.map(d => d.data());
    console.log('👥 Found students:', students.length);

    if (students.length === 0) {
      alert('Tidak ada siswa ditemukan untuk kelas ' + kelas);
      return;
    }

    // fetch existing nilai for this kelas/mapel/bab
    const snapN = await getDocs(query(collection(db, 'nilai_siswa'), where('kelas', '==', kelas), where('mapel', '==', mapel), where('bab', '==', bab)));
    const existing = {};
    snapN.forEach(d => { existing[d.data().nama] = { id: d.id, ...d.data() }; });

    const tbody = document.querySelector('#tabelInputNilai tbody');
    if (!tbody) {
      console.error('❌ Table body not found');
      return;
    }
    tbody.innerHTML = '';

    students.forEach(s => {
      const ex = existing[s.nama] || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.nama}</td>
        <td><input type="number" class="form-control" data-field="tugas1" value="${ex.tugas1 ?? ''}" min="0" max="100"></td>
        <td><input type="number" class="form-control" data-field="tugas2" value="${ex.tugas2 ?? ''}" min="0" max="100"></td>
        <td><input type="number" class="form-control" data-field="tugas3" value="${ex.tugas3 ?? ''}" min="0" max="100"></td>
        <td><input type="number" class="form-control" data-field="uh" value="${ex.uh ?? ''}" min="0" max="100"></td>
      `;
      // store metadata on row for ease
      tr.dataset.nama = s.nama;
      if (ex.id) tr.dataset.docId = ex.id;
      tbody.appendChild(tr);
    });

    document.getElementById('formNilaiContainer')?.classList.remove('hidden');
    console.log('✅ Student table displayed successfully');
  } catch (err) {
    console.error('❌ Error loading students:', err);
    alert('Gagal memuat data siswa: ' + err.message);
  }
});

// Save: update existing doc if docId present, else add new
document.getElementById('formNilaiSiswa')?.addEventListener('submit', async e => {
  e.preventDefault();
  const kelas = document.getElementById('kelasInputSelect').value;
  const mapel = document.getElementById('mapelInputSelect').value;
  const bab = document.getElementById('babSelect').value;
  const rows = document.querySelectorAll('#tabelInputNilai tr');
  try {
    for (const row of rows) {
      const nama = row.dataset.nama;
      const tugas1 = row.querySelector('[data-field="tugas1"]').value || null;
      const tugas2 = row.querySelector('[data-field="tugas2"]').value || null;
      const tugas3 = row.querySelector('[data-field="tugas3"]').value || null;
      const uh = row.querySelector('[data-field="uh"]').value || null;

      if (row.dataset.docId) {
        const ref = doc(db, 'nilai_siswa', row.dataset.docId);
        await updateDoc(ref, { tugas1: tugas1 ? Number(tugas1) : null, tugas2: tugas2 ? Number(tugas2) : null, tugas3: tugas3 ? Number(tugas3) : null, uh: uh ? Number(uh) : null, timestamp: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'nilai_siswa'), {
          uid: currentUser.uid, kelas, mapel, bab, nama,
          tugas1: tugas1 ? Number(tugas1) : null,
          tugas2: tugas2 ? Number(tugas2) : null,
          tugas3: tugas3 ? Number(tugas3) : null,
          uh: uh ? Number(uh) : null,
          semester: 'Ganjil', tahunAjar: '2025/2026', timestamp: serverTimestamp()
        });
      }
    }
    alert('✅ Semua nilai bab berhasil disimpan');
    document.getElementById('formNilaiContainer')?.classList.add('hidden');
  } catch (err) { console.error(err); alert('Gagal menyimpan: ' + err.message); }
});

// ==================== INPUT NILAI SAS & SAT (versi kolom ganda) ====================
document.getElementById('btnMuatSiswaSemester')?.addEventListener('click', async () => {
  const kelas = document.getElementById('kelasSemesterSelect').value;
  const mapel = document.getElementById('mapelInputSAS').value;
  if (!kelas || !mapel) return alert('Pilih kelas dan mapel terlebih dahulu');

  // Ambil daftar siswa
  const snapSiswa = await getDocs(query(collection(db, 'siswa'), where('kelas', '==', kelas)));
  const students = snapSiswa.docs.map(d => d.data());

  // Ambil data SAS & SAT
  const snapNilai = await getDocs(query(collection(db, 'nilai_semester'),
    where('kelas', '==', kelas),
    where('mapel', '==', mapel)
  ));

  // Gabungkan hasil SAS & SAT per siswa
  const nilaiSiswa = {};
  snapNilai.forEach(docSnap => {
    const d = docSnap.data();
    if (!nilaiSiswa[d.nama]) nilaiSiswa[d.nama] = { nama: d.nama };
    nilaiSiswa[d.nama][d.jenis] = { id: docSnap.id, nilai: d.nilai ?? '' };
  });

  // Render tabel
  const tbody = document.querySelector('#tabelInputNilaiSemester tbody');
  if (!tbody) {
    console.error('Elemen tabelInputNilaiSemester tidak ditemukan di halaman');
    return;
  }
  tbody.innerHTML = '';

  students.forEach(s => {
    const sas = nilaiSiswa[s.nama]?.SAS?.nilai ?? '';
    const sat = nilaiSiswa[s.nama]?.SAT?.nilai ?? '';
    const tr = document.createElement('tr');
    tr.dataset.nama = s.nama;
    tr.dataset.sasId = nilaiSiswa[s.nama]?.SAS?.id || '';
    tr.dataset.satId = nilaiSiswa[s.nama]?.SAT?.id || '';
    tr.innerHTML = `
      <td>${s.nama}</td>
      <td><input type="number" class="form-control text-center nilaiSASInput" value="${sas}" min="0" max="100"></td>
      <td><input type="number" class="form-control text-center nilaiSATInput" value="${sat}" min="0" max="100"></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('formSemesterContainer').classList.remove('hidden');
  console.log('✅ Student table for semester displayed successfully');
});


// ==================== SIMPAN NILAI SAS & SAT ====================
// === SIMPAN NILAI SAS & SAT SEKALIGUS ===
document.getElementById('formNilaiSemester')?.addEventListener('submit', async e => {
  e.preventDefault();

  const kelas = document.getElementById('kelasSemesterSelect').value;
  const mapel = document.getElementById('mapelInputSAS').value;
  if (!kelas || !mapel) return alert('Pilih kelas dan mata pelajaran terlebih dahulu');

  const rows = document.querySelectorAll('#tabelInputNilaiSemester tbody tr');

  try {
    for (const row of rows) {
      const nama = row.dataset.nama;
      const sas = row.querySelector('.nilaiSASInput').value || null;
      const sat = row.querySelector('.nilaiSATInput').value || null;

      // 🔹 Jika SAS sudah ada ID (update), kalau belum tambahkan baru
      if (row.dataset.sasId) {
        await updateDoc(doc(db, 'nilai_semester', row.dataset.sasId), {
          nilai: sas ? Number(sas) : null,
          jenis: 'SAS',
          timestamp: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'nilai_semester'), {
          uid: currentUser.uid,
          kelas,
          mapel,
          jenis: 'SAS',
          nama,
          nilai: sas ? Number(sas) : null,
          semester: 'Ganjil',
          tahunAjar: '2025/2026',
          timestamp: serverTimestamp(),
        });
      }

      // 🔹 Simpan nilai SAT
      if (row.dataset.satId) {
        await updateDoc(doc(db, 'nilai_semester', row.dataset.satId), {
          nilai: sat ? Number(sat) : null,
          jenis: 'SAT',
          timestamp: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'nilai_semester'), {
          uid: currentUser.uid,
          kelas,
          mapel,
          jenis: 'SAT',
          nama,
          nilai: sat ? Number(sat) : null,
          semester: 'Genap',
          tahunAjar: '2025/2026',
          timestamp: serverTimestamp(),
        });
      }
    }

    alert('✅ Nilai SAS & SAT berhasil disimpan');
    document.getElementById('formSemesterContainer')?.classList.add('hidden');
  } catch (err) {
    console.error('❌ Gagal menyimpan nilai:', err);
    alert('Terjadi kesalahan saat menyimpan nilai: ' + err.message);
  }
});



// -------------------- REKAP NILAI & EXPORT --------------------
async function loadRekapNilai() {
  const kelas = document.getElementById('filterKelasNilai').value;
  const mapel = document.getElementById('filterMapelNilai').value;
  const babFilter = document.getElementById('filterBabNilai').value;
  const tbody = document.querySelector('#tabelRekapNilai tbody');
  tbody.innerHTML = '';

  // Ambil nilai per bab
  let snapAll = await getDocs(collection(db, 'nilai_siswa'));
  let data = snapAll.docs.map(d => d.data());
  if (kelas) data = data.filter(d => d.kelas === kelas);
  if (mapel) data = data.filter(d => d.mapel === mapel);
  if (babFilter) data = data.filter(d => d.bab === babFilter);

  // Ambil nilai semester
  const snapSem = await getDocs(collection(db, 'nilai_semester'));
  let sem = snapSem.docs.map(d => d.data());
  if (kelas) sem = sem.filter(d => d.kelas === kelas);
  if (mapel) sem = sem.filter(d => d.mapel === mapel);

  if (data.length === 0 && sem.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Belum ada data nilai</td></tr>';
    return;
  }

  // Tampilkan nilai per bab
  data.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.nama || '-'}</td>
      <td>${d.mapel || '-'}</td>
      <td>${d.bab || '-'}</td>
      <td>${d.tugas1 ?? '-'}</td>
      <td>${d.tugas2 ?? '-'}</td>
      <td>${d.tugas3 ?? '-'}</td>
      <td>${d.uh ?? '-'}</td>
      <td>-</td>
    `;
    tbody.appendChild(tr);
  });

  // Tampilkan nilai semester/tahun
  sem.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.nama || '-'}</td>
      <td>${s.mapel || '-'}</td>
      <td>${s.jenis || '-'}</td>
      <td colspan="4">-</td>
      <td>${s.nilai ?? '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}
// bind filter button
document.getElementById('btnFilterNilai')?.addEventListener('click', loadRekapNilai);

// =====================================
// FUNGSI EXPORT PDF JURNAL CUSTOM (LANDSCAPE)
// =====================================
async function exportJurnalPDFCustom() {
  const { jsPDF } = window.jspdf;
  // A4 landscape
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const margin = 15;
  const usableWidth = 297 - margin * 2; // A4 landscape width 297mm
  const fontSize = 11;
  const guru = currentUser?.displayName || currentUser?.email || "Nama Guru";
  const sekolah = "SMP NEGERI 32 SURABAYA";
  const tahunAjar = "2025 – 2026";

  // Ambil data dari Firestore
  const snap = await getDocs(collection(db, "jurnal"));
  let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (!data.length) {
    alert("Tidak ada data jurnal untuk diekspor.");
    return;
  }

  // Kelompokkan berdasarkan tanggal
  const grouped = {};
  data.forEach(item => {
    const tgl = item.tanggal || "-";
    if (!grouped[tgl]) grouped[tgl] = [];
    grouped[tgl].push(item);
  });

  const tanggalList = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

  // Loop per tanggal
  for (let i = 0; i < tanggalList.length; i++) {
    const tanggal = tanggalList[i];
    const rows = grouped[tanggal];

    if (i > 0) doc.addPage();

    // === Header ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("JURNAL HARIAN GURU", 148.5, margin, { align: "center" });
    doc.setFontSize(11);
    doc.text(sekolah, 148.5, margin + 6, { align: "center" });
    doc.text(`Tahun Pelajaran ${tahunAjar}`, 148.5, margin + 12, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.text(`Hari / Tanggal: ${tanggal}`, margin, margin + 25);

    // === Tabel ===
    const head = [[
      "No",
      "Kelas",
      "Jam Ke",
      "Kegiatan Pembelajaran",
      "Siswa Tidak Masuk",
      "Tindak Lanjut"
    ]];

    const body = rows.map((r, idx) => [
      idx + 1,
      r.kelas || "-",
      Array.isArray(r.jamKe) ? r.jamKe.join(", ") : (r.jamKe || "-"),
      r.kegiatan || "-",
      r.siswaTidakMasuk || "-",
      r.tindakLanjut || "-"
    ]);

    doc.autoTable({
      startY: margin + 28,
      head: head,
      body: body,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: fontSize,
        cellPadding: 3,
        overflow: "linebreak",
        halign: "left",
        valign: "top",
        lineColor: 200,
        lineWidth: 0.15
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: 20,
        halign: "center",
        fontStyle: "bold"
      },
      columnStyles: {
        0: { cellWidth: 15 },   // No
        1: { cellWidth: 20 },   // Kelas
        2: { cellWidth: 20 },   // Jam Ke
        3: { cellWidth: 120 },  // Kegiatan Pembelajaran
        4: { cellWidth: 40 },   // Siswa Tidak Masuk
        5: { cellWidth: 45 }    // Tindak Lanjut
      },
      didDrawPage: (data) => {
        // Header ulang otomatis oleh autoTable
      }
    });

    // === Tanda Tangan ===
    const finalY = doc.lastAutoTable.finalY || 200;
    const ttdY = Math.min(200, finalY + 7);
    doc.text("Guru Mata Pelajaran", 240, ttdY);
    doc.text(guru, 240, ttdY + 20);
  }

  // === Simpan PDF ===
  doc.save("Jurnal_Harian_Guru.pdf");
}


// -------------------- // ==========================
// ✏️ CATATAN KELAS (Klasikal)
// ==========================
document.getElementById('formCatatanKelas')?.addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('editIdCatatan').value;
  const data = {
    uid: currentUser.uid,
    tanggal: document.getElementById('tanggalKelas').value,
    kelas: document.getElementById('kelasKelas').value,
    catatan: document.getElementById('catatanKelas').value,
    tindakLanjut: document.getElementById('tindakLanjutKelas').value,
    timestamp: serverTimestamp()
  };
  try {
    if (id) await updateDoc(doc(db, 'catatan_kelas', id), data);
    else await addDoc(collection(db, 'catatan_kelas'), data);
    document.getElementById('formCatatanKelas').reset();
    document.getElementById('editIdCatatan').value = '';
    loadCatatanKelas();
    alert('✅ Catatan kelas berhasil disimpan!');
  } catch (err) {
    console.error(err);
    alert('❌ Gagal menyimpan catatan kelas: ' + err.message);
  }
});

// === Fungsi memuat data catatan kelas ===
async function loadCatatanKelas() {
  const tbody = document.querySelector('#tabelCatatanKelas tbody');
  if (!tbody) return;

  const kelasFilter = document.getElementById('filterKelasCatatan').value;
  const tanggalFilter = document.getElementById('filterTanggalCatatan').value;

  let q = collection(db, 'catatan_kelas');
  const snap = await getDocs(q);
  let allData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (kelasFilter) allData = allData.filter(d => d.kelas === kelasFilter);
  if (tanggalFilter) allData = allData.filter(d => d.tanggal === tanggalFilter);

  // Sort by date (newest first)
  allData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  // Pagination
  const { currentPage, itemsPerPage } = paginationState.catatanKelas;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = allData.slice(startIndex, endIndex);

  tbody.innerHTML = '';

  if (paginatedData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-400">Belum ada catatan kelas</td></tr>';
    renderPagination('pagCatatan', allData.length, currentPage, itemsPerPage);
    return;
  }

  paginatedData.forEach(d => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';
    tr.innerHTML = `
      <td class="px-4 py-3"><input type="checkbox" class="catatan-checkbox rounded" data-id="${d.id}"></td>
      <td class="px-4 py-3">${d.tanggal || '-'}</td>
      <td class="px-4 py-3">${d.kelas || '-'}</td>
      <td class="px-4 py-3">${d.catatan || '-'}</td>
      <td class="px-4 py-3">${d.tindakLanjut || '-'}</td>
      <td class="px-4 py-3">
        <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs mr-1" onclick="editCatatanKelas('${d.id}')">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs" onclick="hapusCatatanKelas('${d.id}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Render pagination controls
  renderPagination('pagCatatan', allData.length, currentPage, itemsPerPage);
}

// Bulk delete for Catatan Kelas
window.deleteSelectedCatatan = async function () {
  const checkboxes = document.querySelectorAll('.catatan-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('Pilih minimal satu catatan untuk dihapus');
    return;
  }

  if (!confirm(`Hapus ${checkboxes.length} catatan kelas yang dipilih?`)) return;

  try {
    for (const checkbox of checkboxes) {
      await deleteDoc(doc(db, 'catatan_kelas', checkbox.dataset.id));
    }
    alert(`✅ ${checkboxes.length} catatan kelas berhasil dihapus`);
    loadCatatanKelas();
  } catch (err) {
    console.error('Error deleting catatan:', err);
    alert('Gagal menghapus catatan: ' + err.message);
  }
};

// Select all catatan
window.toggleSelectAllCatatan = function (checkbox) {
  const checkboxes = document.querySelectorAll('.catatan-checkbox');
  checkboxes.forEach(cb => cb.checked = checkbox.checked);
};

// === Edit & Hapus ===
window.editCatatanKelas = async function (id) {
  const ref = doc(db, 'catatan_kelas', id);
  const snap = await getDocs(collection(db, 'catatan_kelas'));
  const docu = snap.docs.find(d => d.id === id);
  if (!docu) return;
  const data = docu.data();
  document.getElementById('editIdCatatan').value = id;
  document.getElementById('tanggalKelas').value = data.tanggal;
  document.getElementById('kelasKelas').value = data.kelas;
  document.getElementById('catatanKelas').value = data.catatan;
  document.getElementById('tindakLanjutKelas').value = data.tindakLanjut;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.hapusCatatanKelas = async function (id) {
  if (confirm('Hapus catatan kelas ini?')) {
    await deleteDoc(doc(db, 'catatan_kelas', id));
    loadCatatanKelas();
  }
};

// === Filter ===
document.getElementById('btnFilterCatatan')?.addEventListener('click', loadCatatanKelas);

// === Export ===
document.getElementById('exportCatatanExcel')?.addEventListener('click', () => {
  exportTableToExcel('tabelCatatanKelas', 'catatan_kelas');
});

document.getElementById('exportCatatanPDF')?.addEventListener('click', () => {
  printTable('tabelCatatanKelas');
});

// === Load awal ===
loadCatatanKelas();


// ===============================
// Pelanggaran — robust integrasi
// ===============================
// ===================== FITUR CATATAN PELANGGARAN =====================

// Load dropdown kelas dan siswa
async function loadRekapPelanggaran() {
  const tableBody = document.getElementById('rekapPelanggaranBody');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  console.log("📄 Memuat data rekap pelanggaran...");

  try {
    const snap = await getDocs(collection(db, "pelanggaran"));
    const allowedClasses = window.guruData?.kelasDiajar || [];

    let count = 0;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (!data) return;

      // 🧠 Filter hanya kelas yang diajar guru (jika role guru)
      if (window.guruData?.role === 'guru' && !allowedClasses.includes(data.kelas)) return;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${++count}</td>
        <td>${data.namaSiswa || '-'}</td>
        <td>${data.kelas || '-'}</td>
        <td>${data.jenisPelanggaran || '-'}</td>
        <td>${data.tanggal || '-'}</td>
        <td>${data.keterangan || '-'}</td>
      `;
      tableBody.appendChild(row);
    });

    console.log(`✅ Rekap pelanggaran dimuat (${count} baris).`);
  } catch (err) {
    console.error("❌ Gagal memuat rekap pelanggaran:", err);
  }
}


// ketika kelas dipilih → muat siswa
// ===== Guarded listeners untuk modul pelanggaran (menghindari ReferenceError) =====
// formPelanggaran submit — pasang listener jika belum terpasang
const formP = document.getElementById('formPelanggaran');
if (formP) {
  // Clone node untuk menghapus listener lama agar tidak double (atau gunakan flag)
  const newForm = formP.cloneNode(true);
  formP.parentNode.replaceChild(newForm, formP);

  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      // Ambil elemen & nilai
      const kelas = document.getElementById('kelasPelanggaran')?.value || '';
      const siswaSelect = document.getElementById('namaSiswaPelanggaran');
      const siswaValue = siswaSelect?.value || '';
      const jenis = document.getElementById('jenisPelanggaran')?.value || '';
      const poin = Number(document.getElementById('poinPelanggaran')?.value || 0);
      const keterangan = document.getElementById('keteranganPelanggaran')?.value || '';

      if (!kelas || !siswaValue || !jenis) return alert('Lengkapi semua kolom!');

      // Tentukan siswaId dan namaSiswa
      let siswaId = siswaValue;
      let namaSiswa = siswaSelect?.selectedOptions?.[0]?.textContent || siswaValue;

      // Coba treat siswaValue sebagai doc id
      try {
        const docRef = doc(db, 'siswa', siswaValue);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          siswaId = docSnap.id;
          namaSiswa = docSnap.data().nama || namaSiswa;
        }
      } catch (errFetch) {
        console.warn('Cek siswa sebagai doc id gagal:', errFetch);
      }

      // Ambil kategori otomatis
      let kategori = '';
      try {
        const snapJenis = await getDocs(collection(db, 'jenis_pelanggaran'));
        snapJenis.forEach(j => {
          const jd = j.data();
          const namaJenis = jd.nama || jd.jenis || '';
          if (namaJenis === jenis) {
            kategori = jd.kategori || '';
          }
        });
      } catch (errJ) {
        console.warn('Gagal ambil kategori jenis_pelanggaran:', errJ);
      }

      const docObj = {
        siswaId,
        namaSiswa,
        kelas,
        jenis,
        kategori,
        poin,
        keterangan,
        createdAt: new Date().toISOString().slice(0, 10),
        uidGuru: currentUser?.uid || '',
        namaGuru: window.guruData?.nama || currentUser?.email || ''
      };

      await addDoc(collection(db, 'pelanggaran'), docObj);

      alert('✅ Data pelanggaran tersimpan.');
      newForm.reset();
      loadCatatanPelanggaran();
    } catch (err) {
      console.error('Gagal menyimpan pelanggaran:', err);
      alert('Gagal menyimpan pelanggaran: ' + err.message);
    }
  });
}



async function loadCatatanPelanggaran() {
  const tbody = document.querySelector('#tabelPelanggaran tbody');
  if (!tbody) return;

  const kelasF = document.getElementById('filterKelasPelanggaran')?.value || '';
  const siswaF = document.getElementById('filterSiswaPelanggaran')?.value || '';

  // Fetch all but filter later (or use where clause if index exists)
  // Karena index mungkin belum ada, filter client side untuk amannya
  const snap = await getDocs(collection(db, 'pelanggaran'));
  let allData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 🔒 Filter hanya data milik GURU ini
  if (currentUser && window.guruData?.role === 'guru') {
    allData = allData.filter(d => d.uidGuru === currentUser.uid);
  }

  if (kelasF) allData = allData.filter(x => x.kelas === kelasF);
  if (siswaF) allData = allData.filter(x => x.siswaId === siswaF);

  // Pagination
  const { currentPage, itemsPerPage } = paginationState.pelanggaran;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = allData.slice(startIndex, endIndex);

  tbody.innerHTML = '';

  if (paginatedData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-400">Belum ada data pelanggaran</td></tr>`;
    renderPagination('pagPelanggaran', allData.length, currentPage, itemsPerPage);
    return;
  }

  paginatedData.forEach(d => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';
    tr.innerHTML = `
      <td class="px-4 py-3">${d.createdAt || '-'}</td>
      <td class="px-4 py-3">${d.namaSiswa || '-'}</td>
      <td class="px-4 py-3">${d.kelas || '-'}</td>
      <td class="px-4 py-3">${d.jenis || '-'}</td>
      <td class="px-4 py-3">${d.kategori || '-'}</td>
      <td class="px-4 py-3">${d.poin || 0}</td>
      <td class="px-4 py-3">${d.keterangan || '-'}</td>
    `;
    tbody.appendChild(tr);
  });

  // Render pagination controls
  renderPagination('pagPelanggaran', allData.length, currentPage, itemsPerPage);
}


// fungsi cetak
function printFiltered(type) {
  const kelas = document.getElementById('filterKelasPelanggaran').value;
  const siswa = document.getElementById('filterSiswaPelanggaran').value;
  const title =
    type === 'siswa'
      ? `Rekap Pelanggaran ${siswa || '(semua siswa)'}`
      : `Rekap Pelanggaran ${kelas || '(semua kelas)'}`;
  const table = document.getElementById('tabelPelanggaran');
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>${title}</title>`);
  w.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"></head><body>');
  w.document.write(`<h4 class="text-center">${title}</h4>`);
  w.document.write(table.outerHTML);
  w.document.write('</body></html>');
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

// panggil saat auth sukses
onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    initPelanggaranModule();
  }
});

// Tutup sidebar otomatis saat klik menu
document.querySelectorAll('#sidebar .nav-link').forEach(link => {
  link.addEventListener('click', () => {
    const sidebarEl = document.getElementById('sidebar');
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(sidebarEl);
    if (bsOffcanvas) bsOffcanvas.hide(); // sembunyikan
  });
});


// -------------------- END --------------------

console.log('dashboard_guru.js loaded');
