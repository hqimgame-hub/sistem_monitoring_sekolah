// dashboard_admin.js (FULL-FEATURE, STABLE VERSION)
// ==================================================================
// Features included:
// - CRUD akun (guru / kepsek / ketua_kelas) -> collection "users" (+ optional "guru")
// - CRUD siswa -> collection "siswa" with qr_url, auto QR generation/upload
// - CRUD jenis pelanggaran -> collection "jenis_pelanggaran"
// - Import/Export Excel (guru & siswa) using XLSX
// - Generate QR otomatis for siswa without qr_url
// - Cetak kartu PDF (jsPDF) with logo handling
// - Filter kelas and filter role for users
// - Proper DOMContentLoaded handling, no duplicate listeners
// - Defensive checks for missing elements
// ==================================================================

// ===============================
// 🔧 Import Firebase (MODULAR)
// ===============================
import {
  db,
  storage,
  auth,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  collection,
  getDocs,
  addDoc,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  ref,
  uploadBytes,
  serverTimestamp,
  getDownloadURL
} from "./firebase_init.js";
import { renderNavbar } from "./components/Navbar.js";
import { renderSidebar } from "./components/Sidebar.js";

// ===============================
// Firebase config (your project)
// ===============================
//const firebaseConfig = {
//apiKey: "AIzaSyAXg6GUd0Aw1Ku0DmWKN0VNGgrbluO26i8",
//authDomain: "sistem-sekolah-6a1d5.firebaseapp.com",
//projectId: "sistem-sekolah-6a1d5",
//storageBucket: "sistem-sekolah-6a1d5.firebasestorage.app",
//messagingSenderId: "152901594945",
//appId: "1:152901594945:web:a672dd14fe231a89bebbc0"
//};

//const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
//const db = getFirestore(app);
//const storage = getStorage(app);
//const auth = getAuth(app);

// Batasi akses hanya admin
const loggedInUser = JSON.parse(localStorage.getItem("userData"));
if (
  !loggedInUser ||
  !["admin", "guru"].includes(loggedInUser.role) ||
  (loggedInUser.role === "guru" && !loggedInUser.roles?.includes("piket"))
) {
  alert("Akses ditolak! Hanya admin atau guru petugas piket yang boleh mengakses.");
  window.location.href = "index.html";
}




// Auto-login admin (development convenience)
signInWithEmailAndPassword(auth, "admin@sekolah.com", "admin123")
  .then(() => console.log("✅ Login admin berhasil"))
  .catch((err) => console.warn("Login admin otomatis gagal:", err.message));

// -----------------------
// Utility helpers
// -----------------------
function showLoading(show = true) {
  const el = document.getElementById("loadingOverlay");
  if (!el) return;
  el.classList.toggle("hidden", !show);
}

function toast(msg, color = "bg-blue-600") {
  const el = document.createElement("div");
  el.className = `${color} text-white px-4 py-2 rounded shadow mb-2 fixed right-4 top-4 z-50 max-w-sm`;
  el.innerText = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// Ensure code that touches DOM runs after DOM is ready
window.addEventListener("DOMContentLoaded", async () => {
  // -----------------------
  // 1. INIT SHARED UI COMPONENTS
  // -----------------------
  const userData = JSON.parse(localStorage.getItem("userData"));

  if (typeof renderNavbar === "function") {
    renderNavbar({
      title: "Dashboard Admin",
      userEmail: userData?.email || "admin@sekolah.com",
      onLogout: () => {
        // Use global signOut imported from firebase_init.js
        signOut(auth).then(() => {
          localStorage.removeItem("userData");
          window.location.href = "index.html";
        });
      }
    });
  }

  if (typeof renderSidebar === "function") {
    renderSidebar([
      {
        id: 'tabGuru',
        label: 'Data Akun',
        icon: '<i class="bi bi-people text-xl"></i>',
        onClick: () => {
          showSection('sectionGuru');
        }
      },
      {
        id: 'tabSiswa',
        label: 'Data Siswa',
        icon: '<i class="bi bi-person-badge text-xl"></i>',
        onClick: () => {
          showSection('sectionSiswa');
          console.log("Loading siswa data...");
          loadSiswa();
        }
      },
      {
        id: 'tabJenis',
        label: 'Jenis Pelanggaran',
        icon: '<i class="bi bi-exclamation-triangle text-xl"></i>',
        onClick: () => {
          showSection('sectionJenis');
          if (typeof loadJenisPelanggaran === 'function') loadJenisPelanggaran();
        }
      },
      {
        id: 'tabAbsensi',
        label: 'Dashboard Absensi',
        icon: '<i class="bi bi-calendar-check text-xl"></i>',
        onClick: () => {
          showSection('sectionAbsensi');
          if (typeof loadDashboardAbsensi === 'function') loadDashboardAbsensi();
        }
      },
    ]);
  }

  // -----------------------
  // Element references (defensive)
  // -----------------------
  const formUser = document.getElementById("formUser");
  const formSiswa = document.getElementById("formSiswa");
  const tableUser = document.getElementById("tableUser");
  const tableSiswa = document.getElementById("tableSiswa");
  const tableJenis = document.getElementById("tableJenis");
  const filterKelas = document.getElementById("filterKelas");
  const filterRole = document.getElementById("filterRole");
  const kelasWaliSelect = document.getElementById("kelasWali");
  const waliCheckbox = document.getElementById("waliKelas");
  const kelasContainer = document.getElementById("kelasContainer");
  const kelasSelectSiswa = document.getElementById("kelasSelectSiswa");

  // Modal elements for edit (keep compatibility for both modalEditGuru and modalEditUser if present)
  const modalEditGuru = document.getElementById("modalEditGuru");
  const formEditGuru = document.getElementById("formEditGuru");
  const editGuruId = document.getElementById("editGuruId");
  const editGuruNama = document.getElementById("editGuruNama");
  const editGuruEmail = document.getElementById("editGuruEmail");
  const editGuruMapel = document.getElementById("editGuruMapel");
  const editGuruRole = document.getElementById("editGuruRole");
  const btnCloseEditGuru = document.getElementById("btnCloseEditGuru");

  // Additional modalEditUser (if present in your HTML)
  const modalEditUser = document.getElementById("modalEditUser");
  const formEditUser = document.getElementById("formEditUser");
  const editUserId = document.getElementById("editUserId");
  const editUserNama = document.getElementById("editUserNama");
  const editUserEmail = document.getElementById("editUserEmail");
  const editUserRole = document.getElementById("editUserRole");
  const editUserMapel = document.getElementById("editUserMapel");
  const editUserKelas = document.getElementById("editUserKelas");
  const editUserKelasWali = document.getElementById("editUserKelasWali");
  const btnCloseEditUser = document.getElementById("btnCloseEditUser");

  // Buttons
  const btnImportGuru = document.getElementById("btnImportGuru");
  const fileGuru = document.getElementById("fileGuru");
  const btnImportSiswa = document.getElementById("btnImportSiswa");
  const fileSiswa = document.getElementById("fileSiswa");
  const btnDownloadGuruFormat = document.getElementById("btnDownloadGuruFormat");
  const btnDownloadSiswaFormat = document.getElementById("btnDownloadSiswaFormat");
  const btnDownloadSiswa = document.getElementById("btnDownloadSiswa");
  const btnDownloadKartu = document.getElementById("btnDownloadKartu");
  const btnGenerateQR = document.getElementById("btnGenerateQR");
  const btnLogout = document.getElementById("btnLogout");

  // ===============================
  // 📑 TAB LOGIC (Re-implemented INSIDE SCPE)
  // ===============================
  const tabGuru = document.getElementById("tabGuru");
  const tabSiswa = document.getElementById("tabSiswa");
  const tabJenis = document.getElementById("tabJenis");
  const tabAbsensi = document.getElementById("tabAbsensi");

  const sectionGuru = document.getElementById("sectionGuru");
  const sectionSiswa = document.getElementById("sectionSiswa");
  const sectionJenis = document.getElementById("sectionJenis");
  const sectionAbsensi = document.getElementById("sectionAbsensi");

  function showSection(sectionId) {
    console.log(`🔄 showSection called with: ${sectionId}`);

    // 1. Get all sections freshly from DOM
    const sGuru = document.getElementById("sectionGuru");
    const sSiswa = document.getElementById("sectionSiswa");
    const sJenis = document.getElementById("sectionJenis");
    const sAbsensi = document.getElementById("sectionAbsensi");

    console.log(`📊 Before hiding - Guru: ${!sGuru?.classList.contains('hidden')}, Siswa: ${!sSiswa?.classList.contains('hidden')}, Jenis: ${!sJenis?.classList.contains('hidden')}, Absensi: ${!sAbsensi?.classList.contains('hidden')}`);

    // 2. Hide all sections
    [sGuru, sSiswa, sJenis, sAbsensi].forEach(el => {
      if (el) {
        el.classList.add("hidden");
        console.log(`✅ Hidden: ${el.id}`);
      }
    });

    // 3. Reset all tabs
    [tabGuru, tabSiswa, tabJenis, tabAbsensi].forEach(t => {
      if (t) t.classList.remove("bg-blue-500", "text-white", "bg-yellow-500", "bg-purple-500");
    });

    // 4. Show target section
    const target = document.getElementById(sectionId);
    if (target) {
      target.classList.remove("hidden");
      console.log(`✅ Showing: ${sectionId}`);
      console.log(`📊 After showing - Guru: ${!sGuru?.classList.contains('hidden')}, Siswa: ${!sSiswa?.classList.contains('hidden')}, Jenis: ${!sJenis?.classList.contains('hidden')}, Absensi: ${!sAbsensi?.classList.contains('hidden')}`);
    } else {
      console.error(`❌ Tab target not found: ${sectionId}`);
    }
  }


  // --- LISTENERS (Logic now in renderSidebar above) ---
  // Duplicates removed to prevent conflicts

  // Default active tab handling
  if (sectionGuru && !sectionGuru.classList.contains("hidden")) {
    if (tabGuru) tabGuru.classList.add("bg-blue-500", "text-white");
  } else if (sectionSiswa && !sectionSiswa.classList.contains("hidden")) {
    if (tabSiswa) tabSiswa.classList.add("bg-blue-500", "text-white");
  }

  // ===============================
  // 📑 SUB-TAB LOGIC FOR DATA AKUN
  // ===============================
  const tabTambahAkun = document.getElementById("tabTambahAkun");
  const tabDaftarAkun = document.getElementById("tabDaftarAkun");
  const subSectionTambahAkun = document.getElementById("subSectionTambahAkun");
  const subSectionDaftarAkun = document.getElementById("subSectionDaftarAkun");

  function showSubSection(subSectionId) {
    // Hide all sub-sections
    if (subSectionTambahAkun) subSectionTambahAkun.classList.add("hidden");
    if (subSectionDaftarAkun) subSectionDaftarAkun.classList.add("hidden");

    // Reset all sub-tab styles
    if (tabTambahAkun) {
      tabTambahAkun.classList.remove("bg-blue-500", "text-white");
      tabTambahAkun.classList.add("bg-gray-300");
    }
    if (tabDaftarAkun) {
      tabDaftarAkun.classList.remove("bg-blue-500", "text-white");
      tabDaftarAkun.classList.add("bg-gray-300");
    }

    // Show target sub-section
    const target = document.getElementById(subSectionId);
    if (target) {
      target.classList.remove("hidden");

      // Highlight active sub-tab
      if (subSectionId === "subSectionTambahAkun" && tabTambahAkun) {
        tabTambahAkun.classList.remove("bg-gray-300");
        tabTambahAkun.classList.add("bg-blue-500", "text-white");
      } else if (subSectionId === "subSectionDaftarAkun" && tabDaftarAkun) {
        tabDaftarAkun.classList.remove("bg-gray-300");
        tabDaftarAkun.classList.add("bg-blue-500", "text-white");
      }
    }
  }

  // Sub-tab event listeners
  if (tabTambahAkun) {
    tabTambahAkun.addEventListener("click", () => showSubSection("subSectionTambahAkun"));
  }
  if (tabDaftarAkun) {
    tabDaftarAkun.addEventListener("click", () => showSubSection("subSectionDaftarAkun"));
  }

  // Default: show Daftar Akun
  showSubSection("subSectionDaftarAkun");
  // ===============================



  // Fallback checks
  function elExists(id) {
    return !!document.getElementById(id);
  }

  // -----------------------
  // Helpers specific
  // -----------------------
  async function uploadCanvasToStorage(canvas, path) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        try {
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, blob);
          const url = await getDownloadURL(storageRef);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  // -----------------------
  // LOAD KELAS DROPDOWN (for kelasWali and filterKelas)
  // -----------------------
  async function loadKelasDropdown() {
    if (!kelasWaliSelect && !filterKelas) return;
    try {
      const snap = await getDocs(collection(db, "kelas"));
      // reset lists
      if (kelasWaliSelect) {
        kelasWaliSelect.innerHTML = `<option value="">-- Pilih Kelas --</option>`;
      }
      if (filterKelas) {
        filterKelas.innerHTML = `<option value="">-- Semua Kelas --</option>`;
      }
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const name = data.namaKelas || data.name || "";
        if (!name) return;
        if (kelasWaliSelect) {
          const opt = document.createElement("option");
          opt.value = name;
          opt.textContent = name;
          kelasWaliSelect.appendChild(opt);
        }
        if (filterKelas) {
          const opt2 = document.createElement("option");
          opt2.value = name;
          opt2.textContent = name;
          filterKelas.appendChild(opt2);
        }
      });
    } catch (err) {
      console.error("Gagal load kelas:", err);
    }
  }

  // show/hide kelasWali container
  if (waliCheckbox) {
    waliCheckbox.addEventListener("change", () => {
      if (waliCheckbox.checked) {
        if (kelasContainer) kelasContainer.classList.remove("hidden");
        loadKelasDropdown();
      } else {
        if (kelasContainer) kelasContainer.classList.add("hidden");
      }
    });
  }

  // ========================= MAPEL CHECKBOX =========================
  async function tampilkanCheckboxMapel() {
    const container = document.getElementById("listMapelCheckbox");
    if (!container) return;

    container.innerHTML = `<p class="text-gray-400 text-sm col-span-full italic">⏳ Memuat daftar mapel...</p>`;
    try {
      const snap = await getDocs(collection(db, "mapel"));
      if (snap.empty) {
        container.innerHTML = `<p class="text-gray-500 italic col-span-full">Belum ada data mapel di Firestore</p>`;
        return;
      }

      container.innerHTML = ""; // kosongkan sebelum isi ulang
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const label = document.createElement("label");
        label.className = "flex items-center space-x-2 p-1";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = data.nama;
        checkbox.className = "mapelCheckbox w-4 h-4 text-blue-600";

        const span = document.createElement("span");
        span.textContent = data.nama;

        label.appendChild(checkbox);
        label.appendChild(span);
        container.appendChild(label);
      });
    } catch (err) {
      console.error("Gagal memuat mapel:", err);
      container.innerHTML = `<p class="text-red-500 text-sm col-span-full">Gagal memuat data mapel</p>`;
    }
  }

  // ================================
  // 🔽 Fungsi untuk memuat checkbox kelas yang diajar
  // ================================
  async function tampilkanCheckboxKelasDiajar() {
    const container = document.getElementById("listKelasCheckbox");
    if (!container) return;

    container.innerHTML = `<p class="text-gray-400 text-sm col-span-full italic">⏳ Memuat daftar kelas...</p>`;

    try {
      const snap = await getDocs(collection(db, "kelas"));
      if (snap.empty) {
        container.innerHTML = `<p class="text-gray-500 italic col-span-full">Belum ada data kelas di Firestore</p>`;
        return;
      }

      container.innerHTML = "";
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const label = document.createElement("label");
        label.className = "flex items-center space-x-2 p-1";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = data.namaKelas;
        checkbox.className = "kelasDiajarCheckbox w-4 h-4 text-green-600";

        const span = document.createElement("span");
        span.textContent = data.namaKelas;

        label.appendChild(checkbox);
        label.appendChild(span);
        container.appendChild(label);
      });
    } catch (err) {
      console.error("Gagal memuat kelas:", err);
      container.innerHTML = `<p class="text-red-500 text-sm col-span-full">Gagal memuat data kelas</p>`;
    }
  }


  // ============================================
  // 🔽 Fungsi untuk memuat daftar kelas dari Firestore
  // ============================================
  async function loadDropdownKelasGlobal() {
    try {
      const snap = await getDocs(collection(db, "kelas"));
      if (snap.empty) {
        console.warn("⚠️ Koleksi 'kelas' kosong di Firestore.");
        return;
      }

      const kelasList = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const nama = data.namaKelas || data.name || "";
        if (nama) kelasList.push(nama);
      });

      // Isi semua dropdown yang terkait kelas
      const dropdownIds = ["kelasSiswa", "filterKelas", "filterAbsensiKelas", "editUserKelasWali"];
      dropdownIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = `<option value="">-- Pilih Kelas --</option>`;
        kelasList.forEach(k => {
          const opt = document.createElement("option");
          opt.value = k;
          opt.textContent = k;
          el.appendChild(opt);
        });
      });

      console.log("✅ Dropdown kelas berhasil dimuat:", kelasList);
    } catch (err) {
      console.error("Gagal memuat daftar kelas:", err);
    }
  }

  // -----------------------
  // LOAD USERS (tableUser) with PAGINATION
  // -----------------------
  let usersData = [];
  let currentPageUsers = 1;

  async function loadUsers(roleFilter = "", page = 1, limit = "10") {
    const tbody = tableUser || document.getElementById("tableUser");
    if (!tbody) return;
    tbody.innerHTML = "";
    try {
      const colRef = collection(db, "users");
      const q = roleFilter ? query(colRef, where("role", "==", roleFilter)) : query(colRef);
      const snap = await getDocs(q);

      usersData = [];
      snap.forEach(docSnap => {
        const u = docSnap.data();
        usersData.push({ id: docSnap.id, ...u });
      });

      if (usersData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="p-3 text-gray-500 italic">Belum ada data pengguna</td></tr>`;
        return;
      }

      // Pagination logic
      const perPage = limit === "all" ? usersData.length : parseInt(limit);
      const totalPages = Math.ceil(usersData.length / perPage);
      const start = (page - 1) * perPage;
      const end = start + perPage;
      const pageData = usersData.slice(start, end);

      let no = start + 1;
      pageData.forEach(u => {
        if (!Array.isArray(u.roles)) u.roles = [];

        // ✅ Mapel display
        let mapelDisplay = "-";
        if (Array.isArray(u.mapel) && u.mapel.length) mapelDisplay = u.mapel.join(", ");
        else if (typeof u.mapel === "string" && u.mapel.trim()) mapelDisplay = u.mapel;

        // ✅ Kelas yang diajar (baru)
        let kelasDiajarDisplay = "-";
        if (Array.isArray(u.kelasDiajar) && u.kelasDiajar.length)
          kelasDiajarDisplay = u.kelasDiajar.join(", ");
        else if (typeof u.kelasDiajar === "string" && u.kelasDiajar.trim())
          kelasDiajarDisplay = u.kelasDiajar;

        // ✅ Kelas utama / siswa
        const kelasDisplay = u.kelas || "-";

        // ✅ Roles display
        const rolesDisplay = u.roles.length ? u.roles.join(", ") : "-";

        // Buat elemen tabel
        const tr = document.createElement("tr");
        tr.className = "border-b hover:bg-gray-50";
        tr.innerHTML = `
      <td class="p-2 text-center">
    <input type="checkbox" class="selectUserCheckbox w-4 h-4" data-id="${u.id}">
  </td>  
      <td class="p-2">${no++}</td>
        <td class="p-2 text-left">${u.nama || "-"}</td>
        <td class="p-2">${u.email || "-"}</td>
        <td class="p-2 capitalize">${u.role || "-"}</td>
        <td class="p-2">${rolesDisplay}</td>
        <td class="p-2">${mapelDisplay}</td>
        <td class="p-2">${kelasDiajarDisplay}</td>
        <td class="p-2">${kelasDisplay}</td>
        <td class="border px-2 py-1">${u.kelasWali || "-"}</td>
        <td class="p-2 text-center space-x-2">
          <button class="px-2 py-1 rounded bg-yellow-500 text-white editUserBtn" data-id="${u.id}">Edit</button>
          <button class="px-2 py-1 rounded bg-red-500 text-white deleteUserBtn" data-id="${u.id}">Hapus</button>
        </td>
      `;
        tbody.appendChild(tr);
      });

      // Render pagination
      const pagination = document.getElementById("paginationUsers");
      if (pagination) {
        pagination.innerHTML = "";
        if (totalPages > 1) {
          for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement("button");
            btn.className = `px-2 py-1 rounded ${i === page ? "bg-blue-600 text-white" : "bg-gray-200"}`;
            btn.textContent = i;
            btn.onclick = () => {
              currentPageUsers = i;
              loadUsers(roleFilter, i, limit);
            };
            pagination.appendChild(btn);
          }
        }
      }

      // attach events
      tbody.querySelectorAll(".editUserBtn").forEach(btn => {
        btn.addEventListener("click", () => openEditUserModal(btn.dataset.id));
      });
      tbody.querySelectorAll(".deleteUserBtn").forEach(btn => {
        btn.addEventListener("click", () => hapusUser(btn.dataset.id));
      });

    } catch (err) {
      console.error("Gagal load users:", err);
      toast("Gagal memuat pengguna", "bg-red-600");
    }
  }


  // filterRole listener with pagination
  if (filterRole) {
    filterRole.addEventListener("change", (e) => {
      const role = e.target.value || "";
      currentPageUsers = 1; // Reset to page 1
      const limit = document.getElementById("limitUsers")?.value || "10";
      loadUsers(role, 1, limit);
    });
  }

  // limitUsers listener
  const limitUsers = document.getElementById("limitUsers");
  if (limitUsers) {
    limitUsers.addEventListener("change", (e) => {
      currentPageUsers = 1;
      loadUsers(filterRole?.value || "", 1, e.target.value);
    });
  }

  // === Fungsi memuat daftar kelas dari Firestore ===
  async function loadDaftarKelas() {
    try {
      const snapshot = await getDocs(collection(db, "kelas"));
      const selectEl = document.getElementById("kelasSelectSiswa");
      if (!selectEl) return;

      snapshot.forEach(doc => {
        const data = doc.data();
        const namaKelas = data.namaKelas || data.nama || data.name || ""; // ✅ fleksibel
        if (!namaKelas) return;
        const opt = document.createElement("option");
        opt.value = namaKelas;
        opt.textContent = namaKelas;
        selectEl.appendChild(opt);
      });

      console.log("✅ Daftar kelas berhasil dimuat");
    } catch (err) {
      console.error("❌ Gagal memuat kelas:", err);
    }
  }
  window.addEventListener("DOMContentLoaded", loadDaftarKelas);


  // -----------------------
  // Open edit user modal (support both modalEditGuru & modalEditUser)
  // -----------------------
  async function openEditUserModal(id) {
    try {
      const snap = await getDoc(doc(db, "users", id));
      if (!snap.exists()) {
        toast("Data pengguna tidak ditemukan", "bg-red-600");
        return;
      }
      const u = snap.data();

      document.querySelectorAll(".mapelCheckbox").forEach(cb => {
        cb.checked = Array.isArray(u.mapel) && u.mapel.includes(cb.value);
      });

      // prefer using modalEditUser if present (more generic)
      if (modalEditUser && formEditUser) {
        editUserId.value = id;
        editUserNama.value = u.nama || "";
        editUserEmail.value = u.email || "";
        editUserRole.value = u.role || "guru";
        editUserMapel.value = Array.isArray(u.mapel) ? u.mapel.join(", ") : (u.mapel || "");
        editUserKelas.value = u.kelas || "";
        // pastikan dropdown kelas di modal edit sudah terisi
        if (editUserKelasWali) {
          const snapKelas = await getDocs(collection(db, "kelas"));
          editUserKelasWali.innerHTML = `<option value="">-- Pilih Kelas --</option>`;
          snapKelas.forEach(docSnap => {
            const data = docSnap.data();
            const name = data.namaKelas || data.name || "";
            if (name) {
              const opt = document.createElement("option");
              opt.value = name;
              opt.textContent = name;
              editUserKelasWali.appendChild(opt);
            }
          });
        }
        editUserKelasWali.value = u.kelasWali || "";

        editUserKelasWali.value = u.kelasWali || "";
        modalEditUser.classList.remove("hidden");
        return;
      }

      // fallback to modalEditGuru
      if (modalEditGuru && formEditGuru) {
        editGuruId.value = id;
        editGuruNama.value = u.nama || "";
        editGuruEmail.value = u.email || "";
        editGuruMapel.value = Array.isArray(u.mapel) ? u.mapel.join(", ") : (u.mapel || "");
        editGuruRole.value = u.role || "guru";
        modalEditGuru.classList.remove("hidden");
        return;
      }

      // after you set form fields for modalEditUser or modalEditGuru
      const roleList = Array.isArray(u.roles) ? u.roles : [];
      document.querySelectorAll(".editRoleCheckbox").forEach(cb => {
        cb.checked = roleList.includes(cb.value);
      });

      // if no modal found, just prompt
      toast("Modal edit tidak ditemukan di HTML", "bg-yellow-600");

    } catch (err) {
      console.error(err);
      toast("Gagal memuat data pengguna", "bg-red-600");
    }
  }

  // Close edit modals
  if (btnCloseEditUser) btnCloseEditUser.addEventListener("click", () => modalEditUser.classList.add("hidden"));
  if (btnCloseEditGuru) btnCloseEditGuru.addEventListener("click", () => modalEditGuru.classList.add("hidden"));

  // Submit edit generic (modalEditUser)
  if (formEditUser) {
    formEditUser.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = editUserId.value;
      const nama = editUserNama.value.trim();
      const email = editUserEmail.value.trim();
      const role = editUserRole.value;
      const mapel = editUserMapel.value.split(",").map(s => s.trim()).filter(Boolean);
      const kelas = editUserKelas.value.trim();
      const editRoleCheckboxes = document.querySelectorAll(".editRoleCheckbox");
      const updatedRoles = Array.from(editRoleCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      // then include in update:
      await updateDoc(doc(db, "users", id), {
        nama, email, role, mapel: role === "guru" ? mapel : [], kelas: role === "ketua_kelas" ? kelas : "", roles: updatedRoles, updatedAt: serverTimestamp()
      });
      try {
        await updateDoc(doc(db, "users", id), {
          nama,
          email,
          role,
          roles: updatedRoles,
          mapel: role === "guru" ? mapel : [],
          kelas: role === "ketua_kelas" ? kelas : "",
          kelasWali: editUserKelasWali?.value || "",    // ✅ tambahkan ini
          updatedAt: serverTimestamp()
        });
        toast("✅ Data pengguna diperbarui", "bg-green-600");
        modalEditUser.classList.add("hidden");
        await loadUsers(filterRole?.value || "");
      } catch (err) {
        console.error(err);
        toast("Gagal memperbarui pengguna", "bg-red-600");
      }
    });
  }

  // Submit edit fallback (modalEditGuru)
  if (formEditGuru) {
    formEditGuru.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = editGuruId.value;
      const nama = editGuruNama.value.trim();
      const email = editGuruEmail.value.trim();
      const role = editGuruRole.value;
      const mapel = editGuruMapel.value.split(",").map(s => s.trim()).filter(Boolean);
      const roleList = data.roles || [];
      document.querySelectorAll(".editRoleCheckbox").forEach(cb => {
        cb.checked = roleList.includes(cb.value);
      });

      try {
        await updateDoc(doc(db, "users", id), { nama, email, role, mapel: role === "guru" ? mapel : [] });
        toast("✅ Data pengguna diperbarui", "bg-green-600");
        modalEditGuru.classList.add("hidden");
        await loadUsers(filterRole?.value || "");
      } catch (err) {
        console.error(err);
        toast("Gagal memperbarui pengguna", "bg-red-600");
      }
    });
  }

  // -----------------------
  // HAPUS USER
  // -----------------------
  async function hapusUser(id) {
    if (!confirm("Yakin ingin menghapus akun ini?")) return;
    try {
      await deleteDoc(doc(db, "users", id));
      // Also try delete from 'guru' collection if exists
      try { await deleteDoc(doc(db, "guru", id)); } catch (e) { /* ignore */ }
      toast("🗑️ Akun dihapus", "bg-red-600");
      await loadUsers(filterRole?.value || "");
    } catch (err) {
      console.error(err);
      toast("Gagal menghapus akun", "bg-red-600");
    }
  }

  // ===========================
  // HAPUS MASSAL USER
  // ===========================
  const btnDeleteSelectedUsers = document.getElementById("btnDeleteSelectedUsers");
  const selectAllUsers = document.getElementById("selectAllUsers");

  if (btnDeleteSelectedUsers && selectAllUsers) {
    selectAllUsers.addEventListener("change", () => {
      const all = document.querySelectorAll(".selectUserCheckbox");
      all.forEach(cb => cb.checked = selectAllUsers.checked);
    });

    btnDeleteSelectedUsers.addEventListener("click", async () => {
      const checked = Array.from(document.querySelectorAll(".selectUserCheckbox:checked"))
        .map(cb => cb.dataset.id);

      if (!checked.length) return toast("Tidak ada akun yang dipilih", "bg-yellow-600");
      if (!confirm(`Yakin ingin menghapus ${checked.length} akun?`)) return;

      showLoading(true);
      try {
        for (const id of checked) {
          await deleteDoc(doc(db, "users", id));
          try { await deleteDoc(doc(db, "guru", id)); } catch { }
        }
        toast(`🗑️ ${checked.length} akun dihapus`, "bg-green-600");
        await loadUsers(filterRole?.value || "");
      } catch (err) {
        console.error(err);
        toast("Gagal hapus massal user", "bg-red-600");
      } finally {
        showLoading(false);
        selectAllUsers.checked = false;
      }
    });
  }

  // ===========================
  // HAPUS MASSAL SISWA
  // ===========================
  const btnDeleteSelectedSiswa = document.getElementById("btnDeleteSelectedSiswa");
  const selectAllSiswa = document.getElementById("selectAllSiswa");

  if (btnDeleteSelectedSiswa && selectAllSiswa) {
    selectAllSiswa.addEventListener("change", () => {
      const all = document.querySelectorAll(".selectSiswaCheckbox");
      all.forEach(cb => cb.checked = selectAllSiswa.checked);
    });

    btnDeleteSelectedSiswa.addEventListener("click", async () => {
      const checked = Array.from(document.querySelectorAll(".selectSiswaCheckbox:checked"))
        .map(cb => cb.dataset.id);

      if (!checked.length) return toast("Tidak ada siswa yang dipilih", "bg-yellow-600");
      if (!confirm(`Yakin ingin menghapus ${checked.length} siswa?`)) return;

      showLoading(true);
      try {
        for (const id of checked) {
          await deleteDoc(doc(db, "siswa", id));
        }
        toast(`🗑️ ${checked.length} siswa dihapus`, "bg-green-600");
        await loadSiswa(filterKelas?.value || "");
      } catch (err) {
        console.error(err);
        toast("Gagal hapus massal siswa", "bg-red-600");
      } finally {
        showLoading(false);
        selectAllSiswa.checked = false;
      }
    });
  }

  // -----------------------
  // TAMBAH USER (formUser)
  // -----------------------
  if (formUser) {
    formUser.addEventListener("submit", async (e) => {
      e.preventDefault();
      showLoading(true);

      const nama = (document.getElementById("nama")?.value || "").trim();
      const email = (document.getElementById("email")?.value || "").trim();
      const password = (document.getElementById("password")?.value || "").trim();
      const mapelCheckboxes = document.querySelectorAll(".mapelCheckbox:checked");
      const mapel = Array.from(mapelCheckboxes).map(cb => cb.value);
      const kelasCheckboxes = document.querySelectorAll(".kelasDiajarCheckbox:checked");
      const kelasDiajar = Array.from(kelasCheckboxes).map(cb => cb.value);
      const role = (document.getElementById("role")?.value || "guru");
      const waliKelasChecked = waliCheckbox?.checked || false;
      const kelasWali = waliKelasChecked ? (kelasWaliSelect?.value || "") : "";

      if (!nama || !email || !password) {
        toast("Nama, email, dan password wajib diisi", "bg-yellow-600");
        showLoading(false);
        return;
      }

      try {
        // check duplicate email in 'users' collection
        const usersSnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
        if (!usersSnap.empty) {
          toast("Email sudah terdaftar di pengguna", "bg-yellow-600");
          showLoading(false);
          return;
        }

        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const roleCheckboxes = document.querySelectorAll(".roleCheckbox");
        const selectedRoles = Array.from(roleCheckboxes)
          .filter(cb => cb.checked)
          .map(cb => cb.value);

        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          nama,
          email,
          role,
          roles: selectedRoles,
          mapel: role === "guru" ? mapel : [],
          kelasDiajar: role === "guru" ? kelasDiajar : [],
          waliKelas: role === "guru" ? waliKelasChecked : false,
          kelasWali: role === "guru" && waliKelasChecked ? kelasWali : "",
          kelas: role === "ketua_kelas" ? kelasWali : "",
          dibuatPada: new Date().toISOString()
        });

        // keep 'guru' collection for teacher/kepsek compatibility
        if (role === "guru" || role === "kepsek") {
          await setDoc(doc(db, "guru", cred.user.uid), {
            uid: cred.user.uid,
            nama,
            email,
            role,
            mapel,
            kelasDiajar,   // ✅ tambahkan ini
            waliKelas: waliKelasChecked,
            kelasWali,
            dibuatPada: new Date().toISOString()
          });
        }

        toast("✅ Akun berhasil ditambahkan!", "bg-green-600");
        formUser.reset();
        if (kelasContainer) kelasContainer.classList.add("hidden");
        await loadUsers(filterRole?.value || "");

        // Switch to Daftar Akun tab after successful submission
        showSubSection("subSectionDaftarAkun");
      } catch (err) {
        console.error("Gagal menambah user:", err);
        toast("Gagal menambahkan akun: " + (err.message || err), "bg-red-600");
      } finally {
        showLoading(false);
      }
    });
  }

  // ===========================
  // LOAD SISWA (dengan pagination)
  // ===========================
  let siswaData = [];
  let currentPage = 1;

  async function loadSiswa(filter = "", page = 1, limit = "10") {
    const tbody = tableSiswa;
    if (!tbody) return;
    tbody.innerHTML = "";
    try {
      const snap = await getDocs(collection(db, "siswa"));
      siswaData = [];

      snap.forEach(docSnap => {
        const s = docSnap.data();
        if (filter && ((s.kelas || "").toLowerCase() !== filter.toLowerCase())) return;
        siswaData.push({ id: docSnap.id, ...s });
      });

      if (siswaData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-3 text-gray-500 italic">Tidak ada data siswa</td></tr>`;
        return;
      }

      const perPage = limit === "all" ? siswaData.length : parseInt(limit);
      const totalPages = Math.ceil(siswaData.length / perPage);
      const start = (page - 1) * perPage;
      const end = start + perPage;
      const pageData = siswaData.slice(start, end);

      pageData.forEach((s) => {
        const qrHtml = s.qr_url
          ? `<img src="${s.qr_url}" class="mx-auto w-16 h-16 mb-1 rounded" /> <a href="${s.qr_url}" download="QR_${s.nama || 'siswa'}.png" class="block text-xs mt-1 text-blue-600">Download</a>`
          : `<span class="text-gray-400 italic">Belum ada</span>`;
        const tr = document.createElement("tr");
        tr.className = "border-b hover:bg-gray-50";
        tr.innerHTML = `
        <td class="p-2 text-center">
          <input type="checkbox" class="selectSiswaCheckbox w-4 h-4" data-id="${s.id}">
        </td>
        <td class="p-2">${s.nama || "-"}</td>
        <td class="p-2">${s.kelas || "-"}</td>
        <td class="p-2">${s.nis || "-"}</td>
        <td class="p-2 text-center">${qrHtml}</td>
        <td class="p-2 text-center">
          <button class="px-2 py-1 bg-blue-500 text-white rounded editSiswaBtn" data-id="${s.id}">Edit</button>
          <button class="px-2 py-1 bg-red-500 text-white rounded delSiswaBtn" data-id="${s.id}">Hapus</button>
        </td>`;
        tbody.appendChild(tr);
      });

      const pagination = document.getElementById("paginationSiswa");
      if (pagination) {
        pagination.innerHTML = "";
        if (totalPages > 1) {
          for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement("button");
            btn.className = `px-2 py-1 rounded ${i === page ? "bg-blue-600 text-white" : "bg-gray-200"
              }`;
            btn.textContent = i;
            btn.onclick = () => loadSiswa(filter, i, limit);
            pagination.appendChild(btn);
          }
        }
      }

      tbody.querySelectorAll(".editSiswaBtn").forEach((btn) => {
        btn.addEventListener("click", () => openEditSiswaModal(btn.dataset.id));
      });
      tbody.querySelectorAll(".delSiswaBtn").forEach((btn) => {
        btn.addEventListener("click", () => hapusSiswa(btn.dataset.id));
      });
    } catch (err) {
      console.error("Gagal load siswa:", err);
      toast("Gagal memuat siswa", "bg-red-600");
    }
  }
  // 🔹 Event untuk dropdown jumlah per halaman
  document.getElementById("limitSiswa")?.addEventListener("change", (e) => {
    currentPage = 1;
    loadSiswa("", currentPage, e.target.value);
  });

  // Helper: open edit siswa modal (uses existing modalEditSiswa in HTML)
  function openEditSiswaModal(id) {
    const modal = document.getElementById("modalEditSiswa");
    if (!modal) { toast("Modal edit siswa tidak ditemukan", "bg-yellow-600"); return; }
    // fetch siswa data
    getDoc(doc(db, "siswa", id)).then(snap => {
      if (!snap.exists()) return toast("Data siswa tidak ditemukan", "bg-red-600");
      const s = snap.data();
      document.getElementById("editId").value = id;
      document.getElementById("editNama").value = s.nama || "";
      document.getElementById("editKelas").value = s.kelas || "";
      document.getElementById("editNis").value = s.nis || "";
      modal.classList.remove("hidden");
    }).catch(err => {
      console.error(err); toast("Gagal memuat data siswa", "bg-red-600");
    });
  }

  // Edit siswa submit
  document.getElementById("formEditSiswa")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editId").value;
    const nama = document.getElementById("editNama").value.trim();
    const kelas = document.getElementById("editKelas").value.trim();
    const nis = document.getElementById("editNis").value.trim();
    try {
      await updateDoc(doc(db, "siswa", id), { nama, kelas, nis });
      toast("✅ Data siswa diperbarui", "bg-green-600");
      document.getElementById("modalEditSiswa").classList.add("hidden");
      await loadSiswa(filterKelas?.value || "");
    } catch (err) {
      console.error(err);
      toast("Gagal memperbarui data siswa", "bg-red-600");
    }
  });

  // Delete siswa
  async function hapusSiswa(id) {
    if (!confirm("Yakin ingin menghapus siswa ini?")) return;
    try {
      await deleteDoc(doc(db, "siswa", id));
      toast("🗑️ Siswa dihapus", "bg-red-600");
      await loadSiswa(filterKelas?.value || "");
    } catch (err) {
      console.error(err);
      toast("Gagal menghapus siswa", "bg-red-600");
    }
  }

  // Add Siswa (formSiswa)
  if (formSiswa) {
    formSiswa.addEventListener("submit", async (e) => {
      e.preventDefault();
      showLoading(true);
      const nama = (document.getElementById("namaSiswa")?.value || "").trim();
      const kelas = (document.getElementById("kelasSiswa")?.value || "").trim();
      const nis = (document.getElementById("nisSiswa")?.value || "").trim();
      if (!nama || !kelas) {
        toast("Nama dan kelas wajib diisi", "bg-yellow-600");
        showLoading(false); return;
      }
      try {
        const docRef = await addDoc(collection(db, "siswa"), {
          nama, kelas, nis,
          dibuatPada: new Date().toISOString(),
          qr_url: ""
        });
        // create QR to canvas and upload
        const tempDiv = document.createElement("div");
        new QRCode(tempDiv, { text: docRef.id, width: 256, height: 256 });
        await new Promise(r => setTimeout(r, 700));
        const canvas = tempDiv.querySelector("canvas");
        if (canvas) {
          const url = await uploadCanvasToStorage(canvas, `qr_siswa/${docRef.id}.png`);
          await updateDoc(doc(db, "siswa", docRef.id), { qr_url: url });
        }
        toast("✅ Siswa berhasil ditambahkan", "bg-green-600");
        formSiswa.reset();
        await loadSiswa(filterKelas?.value || "");
      } catch (err) {
        console.error(err);
        toast("Gagal menambah siswa", "bg-red-600");
      } finally {
        showLoading(false);
      }
    });
  }

  // Filter kelas change
  if (filterKelas) {
    filterKelas.addEventListener("change", (e) => {
      loadSiswa(e.target.value || "");
    });
  }
  if (kelasSelectSiswa) {
    kelasSelectSiswa.addEventListener("change", () => {
      const kelas = kelasSelectSiswa.value;
      if (kelas) {
        console.log("🔹 Memuat data siswa kelas:", kelas);
        loadSiswa(kelas);
      }
    });
  }
  // -----------------------
  // JENIS PELANGGARAN CRUD
  // -----------------------
  const formJenis = document.getElementById("formJenis");
  const modalJenis = document.getElementById("modalJenis");
  const btnTambahJenis = document.getElementById("btnTambahJenis");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const jenisIdInput = document.getElementById("jenisId");
  const jenisNamaInput = document.getElementById("jenisNama");
  const jenisKategoriInput = document.getElementById("jenisKategori");
  const jenisPoinInput = document.getElementById("jenisPoin");
  const jenisRef = collection(db, "jenis_pelanggaran");

  if (btnTambahJenis) {
    btnTambahJenis.addEventListener("click", () => {
      if (formJenis) formJenis.reset();
      if (jenisIdInput) jenisIdInput.value = "";
      if (modalJenis) modalJenis.classList.remove("hidden");
    });
  }
  if (btnCloseModal) btnCloseModal.addEventListener("click", () => modalJenis.classList.add("hidden"));

  if (formJenis) {
    formJenis.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = jenisIdInput?.value?.trim();
      const nama = jenisNamaInput?.value?.trim();
      const kategori = jenisKategoriInput?.value?.trim() || "-";
      const poin = parseInt(jenisPoinInput?.value || "0");
      if (!nama || isNaN(poin)) {
        toast("Nama dan poin wajib diisi", "bg-yellow-600"); return;
      }
      showLoading(true);
      try {
        if (id) {
          await updateDoc(doc(db, "jenis_pelanggaran", id), { nama, kategori, poin, diperbaruiPada: new Date().toISOString() });
          toast("✅ Jenis pelanggaran diperbarui", "bg-green-600");
        } else {
          await addDoc(jenisRef, { nama, kategori, poin, dibuatPada: new Date().toISOString() });
          toast("✅ Jenis pelanggaran ditambahkan", "bg-green-600");
        }
        modalJenis.classList.add("hidden");
        await loadJenisPelanggaran();
      } catch (err) {
        console.error(err);
        toast("Gagal menyimpan jenis pelanggaran", "bg-red-600");
      } finally {
        showLoading(false);
      }
    });
  }

  async function loadJenisPelanggaran() {
    if (!tableJenis) return;
    tableJenis.innerHTML = "";
    try {
      const snap = await getDocs(jenisRef);
      if (snap.empty) {
        tableJenis.innerHTML = `<tr><td colspan="5" class="p-3 text-gray-500 italic">Belum ada data pelanggaran</td></tr>`;
        return;
      }
      let i = 1;
      snap.forEach(docSnap => {
        const d = docSnap.data();
        const tr = document.createElement("tr");
        tr.className = "border-b";
        tr.innerHTML = `
          <td class="p-2">${i++}</td>
          <td class="p-2">${d.nama || "-"}</td>
          <td class="p-2">${d.kategori || "-"}</td>
          <td class="p-2">${d.poin || 0}</td>
          <td class="p-2 space-x-2">
            <button class="px-2 py-1 bg-yellow-400 rounded editJenisBtn" data-id="${docSnap.id}" data-nama="${d.nama || ""}" data-kategori="${d.kategori || ""}" data-poin="${d.poin || 0}">Edit</button>
            <button class="px-2 py-1 bg-red-500 rounded delJenisBtn" data-id="${docSnap.id}">Hapus</button>
          </td>
        `;
        tableJenis.appendChild(tr);
      });

      // handlers
      tableJenis.querySelectorAll(".editJenisBtn").forEach(btn => {
        btn.addEventListener("click", () => {
          jenisIdInput.value = btn.dataset.id;
          jenisNamaInput.value = btn.dataset.nama;
          if (jenisKategoriInput) jenisKategoriInput.value = btn.dataset.kategori;
          jenisPoinInput.value = btn.dataset.poin;
          modalJenis.classList.remove("hidden");
        });
      });
      tableJenis.querySelectorAll(".delJenisBtn").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("Yakin ingin menghapus jenis pelanggaran ini?")) return;
          showLoading(true);
          try {
            await deleteDoc(doc(db, "jenis_pelanggaran", btn.dataset.id));
            toast("Jenis pelanggaran dihapus!", "bg-green-600");
            await loadJenisPelanggaran();
          } catch (err) {
            console.error(err);
            toast("Gagal hapus jenis pelanggaran", "bg-red-600");
          }
          showLoading(false);
        });
      });

    } catch (err) {
      console.error("Gagal load jenis:", err);
      toast("Gagal memuat jenis pelanggaran", "bg-red-600");
    }
  }


  // -----------------------
  // IMPORT/EXPORT (Excel) - Guru & Siswa
  // -----------------------
  // Import Guru
  if (btnImportGuru && fileGuru) {
    btnImportGuru.addEventListener("click", async () => {
      const file = fileGuru.files[0];
      if (!file) return toast("Pilih file Excel dulu", "bg-yellow-600");
      showLoading(true);
      try {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        for (const r of rows) {
          const nama = r.nama || r.nama_lengkap || "";
          const email = r.email || "";
          const password = r.password || "12345678";
          const role = r.role || "guru";
          const mapel = (r.mapel || "").split(",").map(s => s.trim()).filter(Boolean);
          const kelasDiajar =
            (r.kelasDiajar ||
              r.kelas_diajar ||
              r["Kelas yang Diajar"] ||
              r["kelas yang diajar"] ||
              "")
              .split(",")
              .map(s => s.trim())
              .filter(Boolean);
          const waliKls = r.waliKelas === true || r.waliKelas === "true";
          const kelasWali = waliKls ? (r.kelasWali || "") : "";
          if (!nama || !email) continue;
          // skip if email already exists
          const existing = await getDocs(query(collection(db, "users"), where("email", "==", email)));
          if (!existing.empty) continue;
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await setDoc(doc(db, "users", cred.user.uid), {
            uid: cred.user.uid, nama, email, role, kelas: role === "ketua_kelas" ? kelasWali : "", mapel: role === "guru" ? mapel : [], dibuatPada: new Date().toISOString()
          });
          if (role === "guru" || role === "kepsek") {
            await setDoc(doc(db, "guru", cred.user.uid), { uid: cred.user.uid, nama, email, mapel, role, waliKelas: waliKls, kelasWali, dibuatPada: new Date().toISOString() });
          }
        }
        toast("Import pengguna berhasil!", "bg-green-600");
        await loadUsers(filterRole?.value || "");
      } catch (err) {
        console.error(err);
        toast("Gagal import pengguna: " + (err.message || err), "bg-red-600");
      } finally {
        showLoading(false);
      }
    });
  }

  // Import Siswa
  if (btnImportSiswa && fileSiswa) {
    btnImportSiswa.addEventListener("click", async () => {
      const file = fileSiswa.files[0];
      if (!file) return toast("Pilih file Excel dulu", "bg-yellow-600");
      showLoading(true);
      try {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        for (const r of rows) {
          const nama = r.nama || "";
          const kelas = r.kelas || "";
          const nis = r.nis || "";
          if (!nama || !kelas) continue;
          const docRef = await addDoc(collection(db, "siswa"), { nama, kelas, nis, dibuatPada: new Date().toISOString(), qr_url: "" });
          // generate qr
          const tempDiv = document.createElement("div");
          new QRCode(tempDiv, { text: docRef.id, width: 256, height: 256 });
          await new Promise(r => setTimeout(r, 500));
          const canvas = tempDiv.querySelector("canvas");
          if (canvas) {
            const url = await uploadCanvasToStorage(canvas, `qr_siswa/${docRef.id}.png`);
            await updateDoc(doc(db, "siswa", docRef.id), { qr_url: url });
          }
        }
        toast("Import siswa berhasil!", "bg-green-600");
        await loadSiswa(filterKelas?.value || "");
      } catch (err) {
        console.error(err);
        toast("Gagal import siswa", "bg-red-600");
      } finally {
        showLoading(false);
        fileSiswa.value = "";
      }
    });
  }

  // Download format templates
  if (btnDownloadGuruFormat) {
    btnDownloadGuruFormat.addEventListener("click", () => {
      const data = [{ nama: "Budi Santoso", email: "budi@contoh.com", password: "12345678", mapel: "Matematika, IPA", role: "guru", waliKelas: "true", kelasWali: "7A" }];
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "format_guru");
      XLSX.writeFile(wb, "Format_Import_Guru.xlsx");
    });
  }
  if (btnDownloadSiswaFormat) {
    btnDownloadSiswaFormat.addEventListener("click", () => {
      const data = [{ nama: "Andi", kelas: "7A", nis: "1001" }];
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "format_siswa");
      XLSX.writeFile(wb, "Format_Import_Siswa.xlsx");
    });
  }

  // Download siswa data
  if (btnDownloadSiswa) {
    btnDownloadSiswa.addEventListener("click", async () => {
      showLoading(true);
      try {
        const snap = await getDocs(collection(db, "siswa"));
        if (snap.empty) { toast("Belum ada data siswa", "bg-yellow-600"); showLoading(false); return; }
        const rows = [];
        snap.forEach(docSnap => {
          const s = docSnap.data();
          rows.push({ Nama: s.nama || "-", Kelas: s.kelas || "-", NIS: s.nis || "-", "Link QR": s.qr_url || "-" });
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data_Siswa");
        XLSX.writeFile(wb, "Data_Siswa.xlsx");
        toast("✅ Data siswa diunduh", "bg-green-600");
      } catch (err) {
        console.error(err);
        toast("Gagal mengunduh data siswa", "bg-red-600");
      } finally { showLoading(false); }
    });
  }

  // -----------------------
  // Generate QR otomatis untuk siswa tanpa qr_url
  // -----------------------
  if (btnGenerateQR) {
    btnGenerateQR.addEventListener("click", async () => {
      if (!confirm("Yakin ingin generate QR untuk semua siswa yang belum punya QR?")) return;
      showLoading(true);
      try {
        const snap = await getDocs(collection(db, "siswa"));
        let count = 0;
        for (const docSnap of snap.docs) {
          const s = docSnap.data();
          if (s.qr_url && typeof s.qr_url === "string" && s.qr_url.startsWith("http")) continue;
          const tempDiv = document.createElement("div");
          new QRCode(tempDiv, { text: docSnap.id, width: 256, height: 256 });
          await new Promise(r => setTimeout(r, 400));
          const canvas = tempDiv.querySelector("canvas");
          if (!canvas) continue;
          const url = await uploadCanvasToStorage(canvas, `qr_siswa/${docSnap.id}.png`);
          await updateDoc(doc(db, "siswa", docSnap.id), { qr_url: url });
          count++;
        }
        toast(`✅ QR berhasil dibuat untuk ${count} siswa`, "bg-green-600");
        await loadSiswa(filterKelas?.value || "");
      } catch (err) {
        console.error(err);
        toast("Gagal generate QR otomatis", "bg-red-600");
      } finally { showLoading(false); }
    });
  }

  // -----------------------
  // Cetak kartu (jsPDF) — fix filter sesuai dropdown aktif
  // -----------------------
  if (btnDownloadKartu) {
    btnDownloadKartu.addEventListener("click", async () => {
      showLoading(true);
      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        // ✅ Ambil nilai kelas dari dropdown mana pun yang aktif
        const filter1 = document.getElementById("filterKelas")?.value?.trim() || "";
        const filter2 = document.getElementById("kelasSelectSiswa")?.value?.trim() || "";
        const selectedKelas = filter1 || filter2 || "";

        // ✅ Ambil data hanya dari tampilan yang sudah dimuat (bukan dari Firestore lagi)
        const siswaList = selectedKelas
          ? siswaData.filter(s => (s.kelas || "").toLowerCase() === selectedKelas.toLowerCase())
          : siswaData;

        if (!siswaList.length) {
          toast("Tidak ada siswa untuk dicetak", "bg-yellow-600");
          showLoading(false);
          return;
        }

        if (!siswaList.length) {
          toast("Tidak ada siswa untuk dicetak", "bg-yellow-600");
          showLoading(false);
          return;
        }

        // ----- Setting ukuran kartu -----
        const cardW = 63; // mm
        const cardH = 70; // mm
        const gapX = 5;
        const gapY = 3;

        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();

        // ----- Hitung margin agar di tengah -----
        const totalW = (cardW * 3) + (gapX * 2);
        const totalH = (cardH * 4) + (gapY * 3);
        const marginX = Math.max((pageW - totalW) / 2, 0);
        const marginY = Math.max((pageH - totalH) / 2, 0);

        let x = marginX;
        let y = marginY;
        let count = 0;

        const logoUrl = "./assets/logo.png";
        async function loadLogoBase64(url, maxW = 20, maxH = 20) {
          return new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = function () {
              const canvas = document.createElement("canvas");
              let w = img.width, h = img.height;
              const ratio = Math.min(maxW / w, maxH / h, 1);
              w *= ratio; h *= ratio;
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = () => resolve(null);
            img.src = url;
          });
        }
        const logoBase64 = await loadLogoBase64(logoUrl, 60, 60);

        for (const s of siswaList) {
          // 🔹 Bingkai luar
          doc.setDrawColor(180);
          doc.rect(x, y, cardW, cardH);

          // 🔹 Header teks
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text("Kartu SCAN Siswa", x + 4, y + 8);
          doc.setFontSize(8);
          doc.text("Sekolah", x + 4, y + 13);

          if (logoBase64) {
            doc.addImage(logoBase64, "PNG", x + cardW - 18, y + 3, 12, 12);
          }

          // 🔹 Generate QR baru
          const temp = document.createElement("div");
          new QRCode(temp, { text: s.id || s.nis || s.nama, width: 600, height: 600 });
          await new Promise(r => setTimeout(r, 500));
          const qrImg = temp.querySelector("img");

          if (qrImg) {
            const qrSize = 40; // ukuran QR mm
            const qrX = x + (cardW - qrSize) / 2;
            const qrY = y + 18; // 🔧 ubah jarak QR dari atas
            doc.addImage(qrImg.src, "PNG", qrX, qrY, qrSize, qrSize);
          }

          // 🔹 Nama dan Kelas (atur jarak di sini)
          const namaY = y + cardH - 8; // posisi nama
          const kelasY = y + cardH - 4; // posisi kelas

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(`${s.nama || "-"}`, x + cardW / 2, namaY, { align: "center" });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text(`Kelas: ${s.kelas || "-"}`, x + cardW / 2, kelasY, { align: "center" });

          // 🔹 Pindah ke posisi kartu berikutnya
          count++;
          x += cardW + gapX;
          if (count % 3 === 0) { // 3 kolom
            x = marginX;
            y += cardH + gapY;
          }
          if (count % 12 === 0 && count < siswaList.length) {
            doc.addPage();
            x = marginX;
            y = marginY;
          }
        }

        doc.save("Kartu_Siswa.pdf");
        toast("✅ Kartu berhasil dibuat", "bg-green-600");
      } catch (err) {
        console.error("Gagal cetak kartu:", err);
        toast("Gagal membuat kartu PDF", "bg-red-600");
      } finally {
        showLoading(false);
      }
    });
  }


  // -----------------------
  // LOGOUT button
  // -----------------------
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        await signOut(auth);
        window.location.href = "index.html";
      } catch (err) {
        console.error("Logout error:", err);
        toast("Logout gagal", "bg-red-600");
      }
    });
  }

  // -----------------------
  // Initialize: load dropdowns and data when admin is authenticated
  // -----------------------
  // onAuthStateChanged is already set earlier; but to immediately load UI elements (if admin already authenticated),
  // call initialization functions here too.
  (async () => {
    // 🔧 Render Shared Components
    const user = auth.currentUser;
    renderNavbar({
      title: 'Dashboard Admin',
      userEmail: user ? user.email : 'Admin',
      onLogout: async () => {
        await signOut(auth);
        window.location.href = "index.html";
      }
    });

    renderSidebar([
      { id: 'btnMenuGuru', label: 'Data Akun', onClick: () => showSection('sectionGuru') },
      { id: 'btnMenuSiswa', label: 'Data Siswa', onClick: () => showSection('sectionDataSiswa') },
      { id: 'btnMenuJenis', label: 'Jenis Pelanggaran', onClick: () => showSection('sectionJenis') },
      { id: 'btnMenuAbsensi', label: 'Dashboard Absensi', onClick: () => showSection('sectionAbsensi') },
    ]);

    // Initial Load
    await loadDropdownKelasGlobal();
    await loadUsers(filterRole?.value || "");
    await loadSiswa(filterKelas?.value || "");
    await loadJenisPelanggaran();
    await loadAbsensi(filterAbsensiKelas?.value || "");
    await tampilkanCheckboxMapel();
    await tampilkanCheckboxKelasDiajar();
  })();

  // -----------------------
  // TABS NAVIGATION REMOVED (Replaced by Sidebar)
  // -----------------------
  let absensiData = [];
  let currentPageAbsensi = 1;

  async function loadAbsensi(page = 1, limit = "10") {
    const tbody = document.getElementById("isiTabelAbsensi");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-gray-400">⏳ Memuat data...</td></tr>`;

    // ✅ Tangkap elemen filter dengan aman
    const kelasSelect = document.getElementById("filterAbsensiKelas");
    const tanggalInput = document.getElementById("filterAbsensiTanggal");

    // ✅ Gunakan optional chaining agar tidak error meski elemen belum ada
    const kelasFilter = kelasSelect?.value?.trim() || "";
    const tanggalFilter = tanggalInput?.value?.trim() || "";

    try {
      const q = query(collection(db, "absensi"));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-3">Belum ada data absensi</td></tr>`;
        return;
      }

      absensiData = [];
      let total = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };

      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const kelas = (d.kelas || "").toLowerCase();
        const tanggal = (d.tanggal || "").split("T")[0];
        const status = (d.status || "").toLowerCase();

        // ✅ Filter berdasarkan kelas & tanggal (jika ada)
        if (kelasFilter && kelas !== kelasFilter.toLowerCase()) return;
        if (tanggalFilter && tanggal !== tanggalFilter) return;

        if (status === "hadir") total.hadir++;
        else if (status === "izin") total.izin++;
        else if (status === "sakit") total.sakit++;
        else if (status === "alfa") total.alfa++;

        absensiData.push({ id: docSnap.id, ...d });
      });

      if (absensiData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-3">Tidak ada data sesuai filter</td></tr>`;
        return;
      }

      // Pagination logic
      const perPage = limit === "all" ? absensiData.length : parseInt(limit);
      const totalPages = Math.ceil(absensiData.length / perPage);
      const start = (page - 1) * perPage;
      const end = start + perPage;
      const pageData = absensiData.slice(start, end);

      let no = start + 1;
      let rows = "";
      pageData.forEach(d => {
        const status = (d.status || "").toLowerCase();
        rows += `
        <tr class="border-b hover:bg-gray-50">
          <td class="p-2 text-center">${no++}</td>
          <td class="p-2">${d.nama || "-"}</td>
          <td class="p-2">${d.kelas || "-"}</td>
          <td class="p-2 capitalize">${status}</td>
          <td class="p-2">${d.keterangan || "-"}</td>
          <td class="p-2">${d.tanggal || d.waktu || "-"}</td>
        </tr>`;
      });

      tbody.innerHTML = rows;

      // Render pagination
      const pagination = document.getElementById("paginationAbsensi");
      if (pagination) {
        pagination.innerHTML = "";
        if (totalPages > 1) {
          for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement("button");
            btn.className = `px-2 py-1 rounded ${i === page ? "bg-green-600 text-white" : "bg-gray-200"}`;
            btn.textContent = i;
            btn.onclick = () => {
              currentPageAbsensi = i;
              loadAbsensi(i, limit);
            };
            pagination.appendChild(btn);
          }
        }
      }

      // update statistik di atas
      const jmlHadir = document.getElementById("jmlHadir");
      const jmlIzin = document.getElementById("jmlIzin");
      const jmlSakit = document.getElementById("jmlSakit");
      const jmlAlfa = document.getElementById("jmlAlfa");

      if (jmlHadir) jmlHadir.textContent = total.hadir;
      if (jmlIzin) jmlIzin.textContent = total.izin;
      if (jmlSakit) jmlSakit.textContent = total.sakit;
      if (jmlAlfa) jmlAlfa.textContent = total.alfa;
    } catch (err) {
      console.error("Gagal memuat absensi:", err);
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-3">Gagal memuat data absensi</td></tr>`;
    }
  }

  // Event listener for filter button
  const btnFilterAbsensi = document.getElementById("btnFilterAbsensi");
  if (btnFilterAbsensi) {
    btnFilterAbsensi.addEventListener("click", () => {
      currentPageAbsensi = 1;
      const limit = document.getElementById("limitAbsensi")?.value || "10";
      loadAbsensi(1, limit);
    });
  }

  // Event listener for limitAbsensi
  const limitAbsensi = document.getElementById("limitAbsensi");
  if (limitAbsensi) {
    limitAbsensi.addEventListener("change", (e) => {
      currentPageAbsensi = 1;
      loadAbsensi(1, e.target.value);
    });
  }

  loadDaftarKelas();

  // ========================= DASHBOARD ABSENSI =========================

  // Referensi elemen dashboard
  const tabelAbsensi = document.getElementById("isiTabelAbsensi");
  const chartCanvas = document.getElementById("grafikAbsensi");
  const filterTanggal = document.getElementById("filterTanggal");
  const filterKelasAbsensi = document.getElementById("filterKelas");
  const inputCari = document.getElementById("inputCari");

  // Statistik
  const jmlHadir = document.getElementById("jmlHadir");
  const jmlIzin = document.getElementById("jmlIzin");
  const jmlSakit = document.getElementById("jmlSakit");
  const jmlAlfa = document.getElementById("jmlAlfa");
  const jmlTerlambat = document.getElementById("jmlTerlambat");

  let chartAbsensi; // Simpan chart agar bisa diupdate ulang

  // Ambil data absensi dari Firestore
  async function loadDashboardAbsensi() {
    try {
      const q = collection(db, "absensi");
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter tanggal
      const tanggal = filterTanggal?.value;
      if (tanggal) {
        data = data.filter(d => d.tanggal === tanggal);
      }

      // Filter kelas
      const kelas = filterKelasAbsensi?.value;
      if (kelas) {
        data = data.filter(d => (d.kelas || "").toLowerCase() === kelas.toLowerCase());
      }

      // Pencarian
      const keyword = (inputCari?.value || "").toLowerCase();
      if (keyword) {
        data = data.filter(d => (d.nama || "").toLowerCase().includes(keyword));
      }

      renderTabelAbsensi(data);
      renderStatistik(data);
      renderGrafikAbsensi(data);
    } catch (err) {
      console.error("Gagal memuat data absensi:", err);
      if (tabelAbsensi)
        tabelAbsensi.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Gagal memuat data</td></tr>`;
    }
  }

  // Render tabel absensi
  function renderTabelAbsensi(data = []) {
    if (!tabelAbsensi) return;
    if (!data.length) {
      tabelAbsensi.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-400">Tidak ada data absensi</td></tr>`;
      return;
    }

    let i = 1;
    let html = "";
    data.forEach(d => {
      const status = (d.status || "-").toLowerCase();
      const warna =
        status === "hadir"
          ? "text-green-600 font-semibold"
          : status === "izin"
            ? "text-yellow-500 font-semibold"
            : status === "sakit"
              ? "text-blue-500 font-semibold"
              : status === "alfa"
                ? "text-red-500 font-semibold"
                : "text-gray-500";

      const waktu = d.waktu || d.jam || "-";
      const keterangan = d.keterangan || "-";

      html += `
      <tr class="border-b hover:bg-gray-50">
        <td class="px-3 py-2">${i++}</td>
        <td class="px-3 py-2">${d.nama || "-"}</td>
        <td class="px-3 py-2">${d.kelas || "-"}</td>
        <td class="px-3 py-2 ${warna}">${d.status || "-"}</td>
        <td class="px-3 py-2">${keterangan}</td>
        <td class="px-3 py-2">${waktu}</td>
      </tr>
    `;
    });
    tabelAbsensi.innerHTML = html;
  }

  // Hitung statistik hadir/izin/sakit/alfa/terlambat
  function renderStatistik(data = []) {
    const count = { hadir: 0, izin: 0, sakit: 0, alfa: 0, terlambat: 0 };
    data.forEach(d => {
      const s = (d.status || "").toLowerCase();
      if (s.includes("hadir")) count.hadir++;
      else if (s.includes("izin")) count.izin++;
      else if (s.includes("sakit")) count.sakit++;
      else if (s.includes("alfa")) count.alfa++;
      if (d.keterangan && d.keterangan.toLowerCase().includes("terlambat")) count.terlambat++;
    });

    if (jmlHadir) jmlHadir.textContent = count.hadir;
    if (jmlIzin) jmlIzin.textContent = count.izin;
    if (jmlSakit) jmlSakit.textContent = count.sakit;
    if (jmlAlfa) jmlAlfa.textContent = count.alfa;
    if (jmlTerlambat) jmlTerlambat.textContent = count.terlambat;
  }



  // Buat grafik kehadiran (Chart.js)
  function renderGrafikAbsensi(data = []) {
    if (!chartCanvas) return;

    const labelTanggal = {};
    data.forEach(d => {
      const t = d.tanggal || "-";
      const s = (d.status || "").toLowerCase();
      if (!labelTanggal[t]) labelTanggal[t] = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
      if (s.includes("hadir")) labelTanggal[t].hadir++;
      else if (s.includes("izin")) labelTanggal[t].izin++;
      else if (s.includes("sakit")) labelTanggal[t].sakit++;
      else if (s.includes("alfa")) labelTanggal[t].alfa++;
    });

    const labels = Object.keys(labelTanggal);
    const hadir = labels.map(t => labelTanggal[t].hadir);
    const izin = labels.map(t => labelTanggal[t].izin);
    const sakit = labels.map(t => labelTanggal[t].sakit);
    const alfa = labels.map(t => labelTanggal[t].alfa);

    if (chartAbsensi) chartAbsensi.destroy();
    chartAbsensi = new Chart(chartCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Hadir", data: hadir, backgroundColor: "#22c55e" },
          { label: "Izin", data: izin, backgroundColor: "#eab308" },
          { label: "Sakit", data: sakit, backgroundColor: "#3b82f6" },
          { label: "Alfa", data: alfa, backgroundColor: "#ef4444" },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "top" },
          title: { display: true, text: "Grafik Kehadiran Harian" },
        },
      },
    });
  }

  // Event listener filter
  if (filterTanggal) filterTanggal.addEventListener("change", loadDashboardAbsensi);
  if (filterKelasAbsensi) filterKelasAbsensi.addEventListener("change", loadDashboardAbsensi);
  if (inputCari) inputCari.addEventListener("input", loadDashboardAbsensi);

  // Jalankan otomatis pertama kali
  await loadDashboardAbsensi();

  // ============================================
  // JENIS PELANGGARAN LOGIC (Missing previously)
  // ============================================
  // Variables modalJenis, formJenis etc are already declared above in file
  // We use direct ID lookups or existing vars to avoid conflicts.

  // 1. Load Data
  async function loadJenisPelanggaran() {
    const tbody = document.getElementById("tableJenis");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-gray-400">⏳ Memuat data...</td></tr>';

    try {
      const snap = await getDocs(collection(db, "jenis_pelanggaran"));
      if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-gray-500 italic">Belum ada jenis pelanggaran</td></tr>';
        return;
      }
      tbody.innerHTML = "";
      let no = 1;
      snap.forEach(docSnap => {
        const d = docSnap.data();
        const tr = document.createElement("tr");
        tr.className = "border-b hover:bg-gray-50";
        tr.innerHTML = `
          <td class="p-2">${no++}</td>
          <td class="p-2 text-left font-medium">${d.nama || "-"}</td>
          <td class="p-2">
            <span class="px-2 py-1 rounded text-xs text-white ${d.kategori === 'Ringan' ? 'bg-green-500' :
            d.kategori === 'Sedang' ? 'bg-yellow-500' :
              'bg-red-500'
          }">${d.kategori || "-"}</span>
          </td>
          <td class="p-2 font-bold">${d.poin || 0}</td>
          <td class="p-2 space-x-1">
            <button class="px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600 btnEditJenis" data-id="${docSnap.id}">Edit</button>
            <button class="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 btnDelJenis" data-id="${docSnap.id}">Hapus</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Attach events
      tbody.querySelectorAll(".btnEditJenis").forEach(btn => {
        btn.addEventListener("click", () => openModalJenis(btn.dataset.id));
      });
      tbody.querySelectorAll(".btnDelJenis").forEach(btn => {
        btn.addEventListener("click", () => hapusJenis(btn.dataset.id));
      });

      console.log("✅ Jenis Pelanggaran loaded");
    } catch (err) {
      console.error("Gagal load jenis pelanggaran:", err);
      tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-red-500">Gagal memuat data</td></tr>';
    }
  }

  // 2. Open Modal (Add/Edit)
  // We use existing variables if available, or fetch by ID
  const btnAdd = document.getElementById("btnTambahJenis");
  if (btnAdd) {
    btnAdd.addEventListener("click", () => {
      const f = document.getElementById("formJenis");
      if (f) f.reset();
      document.getElementById("jenisId").value = "";
      const m = document.getElementById("modalJenis");
      if (m) m.classList.remove("hidden");
    });
  }

  // Use document.getElementById directly to avoid redeclaring 'btnCloseModal'
  const btnClose = document.getElementById("btnCloseModal");
  if (btnClose) {
    btnClose.addEventListener("click", () => {
      const m = document.getElementById("modalJenis");
      if (m) m.classList.add("hidden");
    });
  }

  async function openModalJenis(id) {
    try {
      const snap = await getDoc(doc(db, "jenis_pelanggaran", id));
      if (!snap.exists()) return toast("Data tidak ditemukan", "bg-red-600");
      const d = snap.data();
      document.getElementById("jenisId").value = id;
      document.getElementById("jenisNama").value = d.nama || "";
      document.getElementById("jenisKategori").value = d.kategori || "";
      document.getElementById("jenisPoin").value = d.poin || 0;
      const m = document.getElementById("modalJenis");
      if (m) m.classList.remove("hidden");
    } catch (err) {
      console.error(err);
    }
  }

  // 3. Simpan (Add/Update)
  // Use a local variable to grab the element
  const frmJenis = document.getElementById("formJenis");
  if (frmJenis) {
    frmJenis.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("jenisId").value;
      const nama = document.getElementById("jenisNama").value.trim();
      const kategori = document.getElementById("jenisKategori").value;
      const poin = parseInt(document.getElementById("jenisPoin").value) || 0;

      if (!nama || !kategori) return toast("Lengkapi data", "bg-yellow-600");

      showLoading(true);
      try {
        if (id) {
          await updateDoc(doc(db, "jenis_pelanggaran", id), { nama, kategori, poin });
          toast("Data diperbarui", "bg-green-600");
        } else {
          await addDoc(collection(db, "jenis_pelanggaran"), {
            nama, kategori, poin, dibuatPada: new Date().toISOString()
          });
          toast("Jenis pelanggaran ditambahkan", "bg-green-600");
        }
        const m = document.getElementById("modalJenis");
        if (m) m.classList.add("hidden");
        frmJenis.reset();
        await loadJenisPelanggaran();
      } catch (err) {
        console.error(err);
        toast("Gagal menyimpan", "bg-red-600");
      } finally {
        showLoading(false);
      }
    });
  }

  // 4. Hapus
  async function hapusJenis(id) {
    if (!confirm("Hapus jenis pelanggaran ini?")) return;
    try {
      await deleteDoc(doc(db, "jenis_pelanggaran", id));
      toast("Terhapus", "bg-green-600");
      await loadJenisPelanggaran();
    } catch (err) {
      console.error(err);
      toast("Gagal menghapus", "bg-red-600");
    }
  }

  // Expose to window for sidebar
  window.loadJenisPelanggaran = loadJenisPelanggaran;

}); // end DOMContentLoaded


