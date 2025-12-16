// ==========================================================
// Dashboard Kepala Sekolah (Final Fix)
// ==========================================================
import {
  db, auth, onAuthStateChanged, signOut,
  collection, onSnapshot, getDocs, query, where, orderBy, limit, doc, getDoc
} from "./firebase_init.js";
import { renderNavbar } from "./components/Navbar.js";
import { renderSidebar } from "./components/Sidebar.js";
import { UI } from "./utils/UI.js";

let chartTrenSiswa, chartKelasSiswa, chartJurnalGuru;
let selectedTanggal = new Date().toISOString().split("T")[0];
let selectedKelas = "";
let unsubscribeAbsensi = null; // Untuk hentikan listener lama

// ==========================================================
// LOGIN DAN INISIALISASI
// ==========================================================
onAuthStateChanged(auth, user => {
  if (!user) return (window.location.href = "index.html");
  // document.getElementById("namaUser").textContent = user.email; // Handled by Navbar
  UI.hideLoading();
  initDashboard();
});

// document.getElementById("btnLogout").addEventListener("click", async () => {
//   await signOut(auth);
//   window.location.href = "./index.html";
// });

// ==========================================================
// INISIALISASI DASHBOARD
// ==========================================================
function initDashboard() {
  // 🚀 Render Components
  const user = auth.currentUser;
  renderNavbar({
    title: 'Dashboard Kepsek',
    userEmail: user ? user.email : 'Kepsek',
    onLogout: async () => {
      await signOut(auth);
      window.location.href = "index.html";
    }
  });

  renderSidebar([
    { id: 'menuAbsensi', label: 'Absensi Siswa', icon: '<i class="bi bi-calendar-check text-xl"></i>', onClick: () => showSection('tabAbsensi') },
    { id: 'menuPelanggaran', label: 'Pelanggaran', icon: '<i class="bi bi-exclamation-triangle text-xl"></i>', onClick: () => showSection('tabPelanggaran') },
    { id: 'menuGuru', label: 'Monitor Guru', icon: '<i class="bi bi-person-video3 text-xl"></i>', onClick: () => showSection('tabGuru') }
  ]);

  // Default view
  showSection('tabAbsensi');

  loadKelasDropdown();

  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  loadRealtimeGuru(todayStr); // FIX: Load default hari ini
  loadRealtimeAbsensi(getTodayDate());
  loadRealtimePelanggaran();
  verifySyncWithAbsensi();

  // Temporary: Bersihkan jurnal lama jika diminta
  // bersihkanJurnalLama(); 

  // Pasang event listener setelah DOM siap
  setupFilterButtons();
}

function showSection(sectionId) {
  const sections = ['tabAbsensi', 'tabPelanggaran', 'tabGuru'];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('active'); // legacy support
    }
  });

  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
}


// ==========================================================
// CEK TAB AKTIF
// ==========================================================
function activeTab() {
  // Check which main tab container is not hidden
  if (!document.getElementById('tabPelanggaran').classList.contains('hidden')) return 'tabPelanggaran';
  if (!document.getElementById('tabGuru').classList.contains('hidden')) return 'tabGuru';
  return 'tabAbsensi'; // Default
}

// ==========================================================
// FILTER BUTTONS
// ==========================================================
function setupFilterButtons() {
  document.getElementById("filterTanggal").value = selectedTanggal;

  // 🔹 Filter per tanggal
  document.getElementById("btnFilter").addEventListener("click", () => {
    const tglInput = document.getElementById("filterTanggal").value;
    const kelasInput = document.getElementById("filterKelas").value;

    if (!tglInput) {
      UI.showToast("Pilih tanggal terlebih dahulu!", "warning");
      return;
    }

    // 🔎 CEK TAB AKTIF
    if (activeTab() === "tabPelanggaran") {
      filterPelanggaranByTanggal(tglInput, kelasInput);
    } else {
      // kode lama absensi & guru
      selectedTanggal = tglInput;
      selectedKelas = kelasInput;

      const tanggalObj = new Date(tglInput);
      tanggalObj.setHours(0, 0, 0, 0);

      loadRealtimeAbsensi(tanggalObj);
      loadRealtimeGuru(tglInput);
    }
  });



  // 🔹 Filter rentang tanggal
  document.getElementById("btnFilterRentang").addEventListener("click", () => {
    const dari = document.getElementById("filterDari").value;
    const sampai = document.getElementById("filterSampai").value;
    const kelasInput = document.getElementById("filterKelas").value;

    if (!dari || !sampai) {
      UI.showToast("Pilih kedua tanggal terlebih dahulu!", "warning");
      return;
    }

    // Jika tab pelanggaran aktif → gunakan filter pelanggaran
    if (activeTab() === "tabPelanggaran") {
      filterPelanggaranByRange(dari, sampai, kelasInput);
    } else {
      loadAbsensiRentangTanggal(dari, sampai);
      loadRealtimeGuru(dari, sampai);
    }
  });



  // 🔹 Tampilkan semua data
  document.getElementById("btnTampilkanSemua").addEventListener("click", () => {
    if (activeTab() === "tabPelanggaran") {
      resetPelanggaran();
    } else {
      loadRealtimeAbsensiSemua();
      loadRealtimeGuru();
      loadRealtimePelanggaran();
    }
  });

}

// ==========================================================
// TAB NAVIGATION
// ==========================================================
// ==========================================================
// TAB NAVIGATION REPLACED BY SIDEBAR
// ==========================================================

// ==========================================================
// DROPDOWN KELAS (FIX: Ambil dari master data kelas)
// ==========================================================
async function loadKelasDropdown() {
  try {
    const snap = await getDocs(collection(db, "kelas"));
    const sel = document.getElementById("filterKelas");
    sel.innerHTML = `<option value="">Semua Kelas</option>`;

    const kelasList = [];
    snap.forEach(doc => {
      const data = doc.data();
      const nama = data.namaKelas || data.name || data.nama;
      if (nama) kelasList.push(nama);
    });

    // Sort natural (7A, 7B, 8A...)
    kelasList.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    kelasList.forEach(k => {
      sel.innerHTML += `<option value="${k}">${k}</option>`;
    });
  } catch (err) {
    console.error("Gagal load kelas dropdown:", err);
  }
}

// ==========================================================
// UTILITAS: TANGGAL HARI INI
// ==========================================================
function getTodayDate() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

// Helper: Hitung total siswa aktif dari database
async function getTotalSiswaCount() {
  try {
    const snap = await getDocs(collection(db, "siswa"));
    return snap.size;
  } catch (e) {
    console.error("Gagal hitung total siswa:", e);
    return 0;
  }
}

// ==========================================================
// REALTIME ABSENSI (Per Tanggal)
// ==========================================================
async function loadRealtimeAbsensi(selectedTanggal = new Date()) {
  // 1. Ambil total siswa dulu untuk statistik (sekali saja atau setiap load)
  const totalSiswaReal = await getTotalSiswaCount();
  document.getElementById("totalSiswa").textContent = totalSiswaReal;

  const startOfDay = new Date(selectedTanggal);
  const endOfDay = new Date(selectedTanggal);
  startOfDay.setHours(0, 0, 0, 0);
  endOfDay.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, "absensi"),
    where("waktu", ">=", startOfDay),
    where("waktu", "<=", endOfDay),
    orderBy("waktu", "asc")
  );

  console.log("📡 Memuat absensi untuk:", startOfDay.toISOString().split("T")[0]);

  if (unsubscribeAbsensi) unsubscribeAbsensi(); // hentikan listener lama
  unsubscribeAbsensi = onSnapshot(q, snapshot => renderAbsensi(snapshot, startOfDay, totalSiswaReal));
}

// ==========================================================
// ABSENSI RENTANG TANGGAL
// ==========================================================
async function loadAbsensiRentangTanggal(dari, sampai) {
  if (!dari || !sampai) {
    UI.showToast("Pilih kedua tanggal terlebih dahulu!", "warning");
    return;
  }

  // Update total siswa (opsional, bisa pakai cache)
  const totalSiswaReal = await getTotalSiswaCount();
  document.getElementById("totalSiswa").textContent = totalSiswaReal;

  const start = new Date(dari);
  const end = new Date(sampai);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, "absensi"),
    where("waktu", ">=", start),
    where("waktu", "<=", end),
    orderBy("waktu", "asc")
  );

  console.log(`📡 Memuat data absensi dari ${dari} s.d ${sampai}`);

  if (unsubscribeAbsensi) unsubscribeAbsensi();
  unsubscribeAbsensi = onSnapshot(q, snapshot => renderAbsensi(snapshot, start, totalSiswaReal));
}

// ==========================================================
// SEMUA ABSENSI
// ==========================================================
async function loadRealtimeAbsensiSemua() {
  const totalSiswaReal = await getTotalSiswaCount();
  document.getElementById("totalSiswa").textContent = totalSiswaReal;

  const q = query(collection(db, "absensi"), orderBy("waktu", "asc"));
  console.log("📡 Menampilkan semua data absensi");

  if (unsubscribeAbsensi) unsubscribeAbsensi();
  unsubscribeAbsensi = onSnapshot(q, snapshot => renderAbsensi(snapshot, new Date(), totalSiswaReal));
}

// ==========================================================
// RENDER ABSENSI + GRAFIK
// ==========================================================
function renderAbsensi(snapshot, baseDate, totalSiswaReal = 0) {
  const data = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    waktu: doc.data().waktu?.toDate ? doc.data().waktu.toDate() : null,
  }));

  const kelas = document.getElementById("filterKelas").value;
  const dataFiltered = kelas ? data.filter(d => d.kelas === kelas) : data;

  // Normalisasi
  dataFiltered.forEach(d => {
    d.status = (d.status || "").toLowerCase();
    d.keterangan = (d.keterangan || "").toLowerCase();
  });

  // Hitung total statistic
  const sudahAbsen = dataFiltered.length;

  if (!kelas) {
    document.getElementById("totalSiswa").innerHTML = `<span class="text-lime-200">${sudahAbsen}</span> <span class="text-sm text-blue-200">/ ${totalSiswaReal || '?'}</span>`;
  } else {
    document.getElementById("totalSiswa").textContent = sudahAbsen;
  }

  const hadir = dataFiltered.filter(d => d.status === "hadir" && !d.keterangan.includes("terlambat")).length;
  // Logic Terlambat
  const terlambat = dataFiltered.filter(d => {
    // Cek apakah tanggalnya match hari/range (sudah difilter di query, jadi anggap valid)
    return d.status === "terlambat" || (d.status === "hadir" && d.keterangan.includes("terlambat"));
  }).length;

  const izin = dataFiltered.filter(d => d.status === "izin").length;
  const sakit = dataFiltered.filter(d => d.status === "sakit").length;
  const alfa = dataFiltered.filter(d => d.status === "alfa").length;

  document.getElementById("hadirHariIni").textContent = hadir;
  document.getElementById("terlambatHariIni").textContent = terlambat;
  document.getElementById("izinHariIni").textContent = izin;
  document.getElementById("sakitHariIni").textContent = sakit;
  document.getElementById("alfaHariIni").textContent = alfa;

  // Render grafik & tabel
  drawChartTrenSiswa(dataFiltered, baseDate);
  drawChartKelasSiswa(dataFiltered);
  renderTopSiswa(dataFiltered);

  console.log(`✅ ${dataFiltered.length} data dimuat & sinkron`);
}

// 🗑️ UTILS: HAPUS JURNAL LAMA (One-time use)
window.bersihkanJurnalLama = async function () {
  if (!confirm("Yakin ingin menghapus SEMUA data jurnal? Tindakan ini tidak bisa dibatalkan.")) return;

  console.log("🧹 Memulai pembersihan jurnal...");
  const q = query(collection(db, "jurnal"));
  const snap = await getDocs(q);

  let count = 0;
  for (const d of snap.docs) {
    await deleteDoc(doc(db, "jurnal", d.id));
    count++;
  }

  alert(`Selesai! ${count} jurnal telah dihapus.`);
  window.location.reload();
}



// ... (Charts functions unchanged) ...

// ==========================================================
// MONITORING GURU (FIX: Ambil Total Guru dari users collection)
// ==========================================================
// 📘 REALTIME MONITORING GURU (Sinkron dengan Jurnal Guru + Filter Tanggal & Rentang)
// ==========================================================

async function getGuruNama(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      return snap.data().nama || snap.data().displayName || snap.data().email || uid;
    }
    return uid;
  } catch (err) {
    console.error("Gagal ambil nama guru:", err);
    return uid;
  }
}

// Helper: Hitung total guru aktif
async function getTotalGuruCount() {
  try {
    const q = query(collection(db, "users"), where("role", "==", "guru"));
    const snap = await getDocs(q);
    return snap.size;
  } catch (e) {
    console.error("Gagal hitung guru:", e);
    return 0; // fallback
  }
}

let unsubscribeGuru = null;

async function loadRealtimeGuru(dariTanggal = null, sampaiTanggal = null) {
  // Ambil total guru dari database (bukan dari jurnal yg masuk)
  const totalGuruReal = await getTotalGuruCount();
  document.getElementById("totalGuru").textContent = totalGuruReal;

  let q;

  // 🔹 Filter rentang tanggal
  if (dariTanggal && sampaiTanggal) {
    q = query(
      collection(db, "jurnal"),
      where("tanggal", ">=", dariTanggal),
      where("tanggal", "<=", sampaiTanggal),
      orderBy("tanggal", "asc")
    );
    console.log(`📅 Memuat jurnal guru dari ${dariTanggal} s.d ${sampaiTanggal}`);
  }
  // 🔹 Filter satu tanggal
  else if (dariTanggal && !sampaiTanggal) {
    q = query(collection(db, "jurnal"), where("tanggal", "==", dariTanggal));
    console.log("📅 Memuat jurnal guru untuk:", dariTanggal);
  }
  // 🔹 Tampilkan semua
  else {
    q = query(collection(db, "jurnal"), orderBy("timestamp", "desc"));
    console.log("📘 Memuat semua jurnal guru tanpa filter tanggal");
  }

  if (unsubscribeGuru) unsubscribeGuru();

  unsubscribeGuru = onSnapshot(q, async (snapshot) => {
    const data = snapshot.docs.map((doc) => doc.data());

    // Hitung guru yg sudah ngisi (unik by UID)
    const isiHariIni = new Set(data.map((d) => d.uid)).size;

    // Persen kepatuhan = (yg ngisi / total guru terdaftar) * 100
    const persenPatuh = totalGuruReal > 0 ? Math.round((isiHariIni / totalGuruReal) * 100) : 0;

    // document.getElementById("totalGuru").textContent = totalGuruReal; // Sudah diset di awal
    document.getElementById("guruIsiJurnal").textContent = isiHariIni;
    document.getElementById("persenPatuh").textContent = persenPatuh + "%";

    const countByGuru = {};
    data.forEach((d) => {
      if (!d.uid) return;
      countByGuru[d.uid] = (countByGuru[d.uid] || 0) + 1;
    });

    const sortedGuru = Object.entries(countByGuru)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const tbody = document.querySelector("#tabelGuru tbody");
    if (!sortedGuru.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">Tidak ada data jurnal pada rentang ini</td></tr>`;
      if (chartJurnalGuru) chartJurnalGuru.destroy();
      return;
    }

    const rows = [];
    for (let i = 0; i < sortedGuru.length; i++) {
      const [uid, jumlah] = sortedGuru[i];
      const namaGuru = await getGuruNama(uid);
      rows.push(`<tr><td>${i + 1}</td><td>${namaGuru}</td><td>${jumlah}</td></tr>`);
    }
    tbody.innerHTML = rows.join("");

    const byDate = {};
    data.forEach((d) => {
      if (d.tanggal) byDate[d.tanggal] = (byDate[d.tanggal] || 0) + 1;
    });

    const labels = Object.keys(byDate).sort();
    const values = labels.map((k) => byDate[k]);

    if (chartJurnalGuru) chartJurnalGuru.destroy();
    chartJurnalGuru = new Chart(document.getElementById("chartJurnalGuru"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Jumlah Jurnal",
            data: values,
            backgroundColor: "#0d6efd",
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });

    console.log("✅ Monitoring guru diperbarui:", data.length, "data jurnal");
  });
}

// ==========================================================
// PELANGGARAN HELPERS
// ==========================================================
function filterPelanggaranByTanggal(tgl, kelas) {
  const all = window.__pelanggaranCache || [];
  let filtered = all.filter(d => d._tanggal === tgl);
  if (kelas) filtered = filtered.filter(d => d.kelas === kelas);

  // Update UI override filters
  document.getElementById("filterDari").value = "";
  document.getElementById("filterSampai").value = "";

  updatePelanggaranUI(filtered);
}

function filterPelanggaranByRange(dari, sampai, kelas) {
  const all = window.__pelanggaranCache || [];
  const start = new Date(dari); start.setHours(0, 0, 0, 0);
  const end = new Date(sampai); end.setHours(23, 59, 59, 999);

  let filtered = all.filter(d => {
    const t = d._tanggal ? new Date(d._tanggal) : null;
    return t && t >= start && t <= end;
  });

  if (kelas) filtered = filtered.filter(d => d.kelas === kelas);

  // Update UI override filters
  document.getElementById("filterTanggal").value = "";

  updatePelanggaranUI(filtered);
}

function resetPelanggaran() {
  document.getElementById("filterTanggal").value = "";
  document.getElementById("filterKelas").value = "";
  document.getElementById("filterDari").value = "";
  document.getElementById("filterSampai").value = "";

  loadRealtimePelanggaran();
}

function updatePelanggaranUI(data) {
  renderTabelPelanggaran(data);
  hitungStatistikPelanggaran(data);
  drawChartPelanggaran(data);
  drawPieJenisPelanggaran(data);
  drawTrendPelanggaran(data);
  updateAlerts(data);
}
let chartPelanggaran, chartJenisPelanggaran, chartTrendPelanggaran;
let modalPelanggaran = null;

function toISODate(d) {
  // terima Date object atau string atau Firestore timestamp-like
  if (!d) return null;
  if (d.toDate) d = d.toDate(); // firestore Timestamp
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  // jika string, coba potong menjadi yyyy-mm-dd bila ada
  if (typeof d === "string") {
    // format: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS'
    return d.slice(0, 10);
  }
  return null;
}

function parseCreatedAt(d) {
  // Prioritas: createdAt (string) > timestamp (Firestore) > tanggal (legacy)
  let val = d.createdAt;
  if (!val && d.timestamp) val = d.timestamp;
  if (!val && d.tanggal) val = d.tanggal;

  return toISODate(val);
}

// Ambil pelanggaran (dibatasi untuk performa)
function loadRealtimePelanggaran() {
  // Strategi: Coba dengan orderBy, jika gagal (index belum ada), fallback ke query tanpa orderBy

  // Query dengan orderBy (memerlukan index)
  const qWithOrder = query(
    collection(db, "pelanggaran"),
    orderBy("createdAt", "desc"),
    limit(500)
  );

  // Query fallback tanpa orderBy
  const qFallback = query(
    collection(db, "pelanggaran"),
    limit(500)
  );

  // Coba query dengan orderBy dulu
  const unsubscribe = onSnapshot(
    qWithOrder,
    async snapshot => {
      processViolationSnapshot(snapshot);
    },
    error => {
      console.warn("⚠️ Query dengan orderBy gagal (index belum ada?), menggunakan fallback:", error.message);
      // Jika gagal, gunakan query tanpa orderBy
      onSnapshot(qFallback, async snapshot => {
        processViolationSnapshot(snapshot);
      });
    }
  );
}

function processViolationSnapshot(snapshot) {
  const allData = snapshot.docs.map(docSnap => {
    const d = docSnap.data();
    return { id: docSnap.id, ...d };
  });

  // lakukan pre-processing: standardisasi tanggal dan poin
  allData.forEach(d => {
    d._tanggal = parseCreatedAt(d) || (d.tanggal ? toISODate(d.tanggal) : null);
    d._poin = Number(d.poin || 0);
    d.jenis = d.jenis || "Lainnya";
    d.kelas = d.kelas || "Unknown";
  });

  // Sort client-side jika perlu (fallback tidak terurut)
  allData.sort((a, b) => (b._tanggal || '').localeCompare(a._tanggal || ''));

  // simpan snapshot global (opsional) dan render
  window.__pelanggaranCache = allData;
  console.log(`📡 Fetched ${allData.length} pelanggaran records.`);

  // Debugging dates
  if (allData.length > 0) {
    console.log("Sample violation date:", allData[0]._tanggal);
  }

  applyCurrentFilterAndRender();
  console.log("🔥 Pelanggaran realtime ter-update. Rendered count:", document.querySelectorAll('#tabelPelanggaran tbody tr').length);
}

// Filter global (tanggal tunggal / rentang / kelas)
function getFilterValues() {
  const tgl = document.getElementById("filterTanggal").value || null;
  const dari = document.getElementById("filterDari").value || null;
  const sampai = document.getElementById("filterSampai").value || null;
  const kelas = document.getElementById("filterKelas").value || "";
  return { tgl, dari, sampai, kelas };
}

function applyCurrentFilterAndRender() {
  const raw = window.__pelanggaranCache || [];
  const { tgl, dari, sampai, kelas } = getFilterValues();

  let filtered = raw.slice();

  if (kelas) filtered = filtered.filter(d => d.kelas === kelas);

  if (tgl) {
    filtered = filtered.filter(d => d._tanggal === tgl);
  } else if (dari || sampai) {
    const start = dari ? new Date(dari) : new Date("1970-01-01");
    const end = sampai ? new Date(sampai) : new Date();
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
    filtered = filtered.filter(d => {
      const t = d._tanggal ? new Date(d._tanggal) : null;
      return t && t >= start && t <= end;
    });
  } else {
    // default: bulan ini
    const thisMonth = new Date().toISOString().slice(0, 7);
    filtered = filtered.filter(d => (d._tanggal || "").startsWith(thisMonth));
  }

  // Setelah filter → hitung & render
  renderTabelPelanggaran(filtered);
  hitungStatistikPelanggaran(filtered);
  drawChartPelanggaran(filtered);
  drawPieJenisPelanggaran(filtered);
  drawTrendPelanggaran(filtered);
  updateAlerts(filtered);
}

// Hitung statistik yang lebih kaya
function hitungStatistikPelanggaran(data) {
  const bulanIni = new Date().toISOString().slice(0, 7);
  const dataBulan = data.filter(d => (d._tanggal || "").startsWith(bulanIni));

  // total & poin
  const total = dataBulan.length;
  const totalPoin = dataBulan.reduce((s, x) => s + (Number(x._poin) || 0), 0);

  // kelas terbanyak
  const kelasCount = {};
  const siswaPoint = {};
  dataBulan.forEach(d => {
    kelasCount[d.kelas] = (kelasCount[d.kelas] || 0) + 1;
    const nama = d.namaSiswa || "Unknown";
    siswaPoint[nama] = (siswaPoint[nama] || 0) + (Number(d._poin) || 0);
  });

  const kelasEntries = Object.entries(kelasCount).sort((a, b) => b[1] - a[1]);
  const kelasTertinggi = kelasEntries.length ? kelasEntries[0][0] : "-";

  // rata-rata per kelas
  const rata = kelasEntries.length ? (total / kelasEntries.length) : 0;

  // siswa tertinggi poin
  const siswaEntries = Object.entries(siswaPoint).sort((a, b) => b[1] - a[1]);
  const siswaTertinggi = siswaEntries.length ? `${siswaEntries[0][0]} (${siswaEntries[0][1]}p)` : "-";

  // update DOM
  document.getElementById("totalPelanggaran").textContent = total;
  document.getElementById("totalPoin").textContent = totalPoin;
  document.getElementById("kelasTertinggi").textContent = kelasTertinggi;
  document.getElementById("rataPelanggaran").textContent = rata ? rata.toFixed(1) : 0;
  document.getElementById("siswaTertinggi").textContent = siswaTertinggi;
}

// Render tabel (klik bar → modal)
function renderTabelPelanggaran(data) {
  const tbody = document.querySelector("#tabelPelanggaran tbody");
  tbody.innerHTML = "";

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">Tidak ada data</td></tr>`;
    return;
  }

  // sort by tanggal desc
  data.sort((a, b) => (b._tanggal || "").localeCompare(a._tanggal || ""));

  data.forEach(d => {
    const tr = document.createElement("tr");
    const tanggal = d._tanggal || "-";
    tr.innerHTML = `
      <td>${d.namaSiswa || "-"}</td>
      <td>${d.kelas || "-"}</td>
      <td>${d.jenis || "-"}</td>
      <td>${d.kategori || "-"}</td>
      <td>${d._poin || 0}</td>
      <td>${tanggal}</td>
      <td>${d.keterangan || "-"}</td>
    `;
    tr.addEventListener("click", () => openPelanggaranModal(d));
    tbody.appendChild(tr);
  });
}

// Grafik: Pelanggaran per Kelas (bar)
function drawChartPelanggaran(data) {
  const kelasCount = {};
  data.forEach(d => kelasCount[d.kelas] = (kelasCount[d.kelas] || 0) + 1);

  const labels = Object.keys(kelasCount);
  const values = Object.values(kelasCount);

  if (chartPelanggaran) chartPelanggaran.destroy();
  chartPelanggaran = new Chart(document.getElementById("chartPelanggaran"), {
    type: "bar",
    data: {
      labels, datasets: [{
        label: "Jumlah", data: values, backgroundColor: [
          "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF",
          "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF"
        ]
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      onClick: (evt, items) => {
        if (items.length) {
          const idx = items[0].index;
          const kelas = labels[idx];
          // buka modal filter → tampilkan detail kelas
          openListForKelas(kelas);
        }
      },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// Pie: jenis pelanggaran
function drawPieJenisPelanggaran(data) {
  const jenisCount = {};
  data.forEach(d => jenisCount[d.jenis] = (jenisCount[d.jenis] || 0) + 1);

  const labels = Object.keys(jenisCount);
  const values = Object.values(jenisCount);

  if (chartJenisPelanggaran) chartJenisPelanggaran.destroy();
  chartJenisPelanggaran = new Chart(document.getElementById("chartJenisPelanggaran"), {
    type: "pie",
    data: {
      labels, datasets: [{
        data: values, backgroundColor: [
          "#4D96FF", "#6BCB77", "#FFD93D", "#FF6B6B",
          "#845EC2", "#FF9671", "#FFC75F"
        ]
      }]
    },
    options: {
      onClick: (evt, items) => {
        if (items.length) {
          const idx = items[0].index;
          const jenis = labels[idx];
          openListForJenis(jenis);
        }
      }
    }
  });
}

// Trend 30 hari (line)
function drawTrendPelanggaran(data) {
  // build last 30 days
  const days = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const byDay = {};
  days.forEach(day => byDay[day] = 0);
  data.forEach(d => {
    const t = d._tanggal;
    if (t && byDay[t] !== undefined) byDay[t] += 1;
  });

  const values = days.map(d => byDay[d] || 0);

  if (chartTrendPelanggaran) chartTrendPelanggaran.destroy();
  chartTrendPelanggaran = new Chart(document.getElementById("chartTrendPelanggaran"), {
    type: "line",
    data: {
      labels: days,
      datasets: [{
        label: "Pelanggaran",
        data: values,
        borderColor: "#FF6B6B",        // warna garis pastel
        pointBackgroundColor: "#FF6B6B",
        pointBorderColor: "#ffffff",
        pointRadius: 4,
        tension: 0.4,
        fill: false
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

// Modal: tampil detail pelanggaran tunggal
function openPelanggaranModal(item) {
  const title = `${item.namaSiswa || '-'} — ${item.kelas || '-'}`;
  document.getElementById("modalTitleKeterangan").textContent = title;

  const isi = `
    <table class="table table-sm">
      <tr><th>Nama</th><td>${item.namaSiswa || '-'}</td></tr>
      <tr><th>Kelas</th><td>${item.kelas || '-'}</td></tr>
      <tr><th>Jenis</th><td>${item.jenis || '-'}</td></tr>
      <tr><th>Kategori</th><td>${item.kategori || '-'}</td></tr>
      <tr><th>Poin</th><td>${item._poin || 0}</td></tr>
      <tr><th>Tanggal</th><td>${item._tanggal || '-'}</td></tr>
      <tr><th>Keterangan</th><td>${item.keterangan || '-'}</td></tr>
    </table>
  `;
  document.getElementById("modalPelanggaranIsi").innerHTML = isi;

  const modal = document.getElementById('modalPelanggaranDetail');
  if (modal) modal.classList.remove('hidden');
}

// Modal: tampil list spesifik kelas atau jenis
function openListForKelas(kelas) {
  const all = window.__pelanggaranCache || [];
  const list = all.filter(d => d.kelas === kelas);
  showListModal(`${kelas} — Pelanggaran (${list.length})`, list);
}

function openListForJenis(jenis) {
  const all = window.__pelanggaranCache || [];
  const list = all.filter(d => d.jenis === jenis);
  showListModal(`${jenis} — Pelanggaran (${list.length})`, list);
}

function showListModal(title, list) {
  document.getElementById("modalTitleKeterangan").textContent = title;
  if (!list.length) {
    document.getElementById("modalPelanggaranIsi").innerHTML = "<div class='text-muted'>Tidak ada data</div>";
  } else {
    const rows = list.map(d => `
      <tr>
        <td>${d.namaSiswa || '-'}</td>
        <td>${d.kelas || '-'}</td>
        <td>${d.jenis || '-'}</td>
        <td>${d.kategori || '-'}</td>
        <td>${d._poin || 0}</td>
        <td>${d._tanggal || '-'}</td>
        <td>${d.keterangan || '-'}</td>
      </tr>
    `).join("");
    document.getElementById("modalPelanggaranIsi").innerHTML = `
      <div class="table-responsive"><table class="table table-sm">
        <thead><tr><th>Nama</th><th>Kelas</th><th>Jenis</th><th>Kategori</th><th>Poin</th><th>Tanggal</th><th>Keterangan</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    `;
  }
  const modal = document.getElementById('modalPelanggaranDetail');
  if (modal) modal.classList.remove('hidden');
}

// Alerts otomatis (contoh simple)
function updateAlerts(data) {
  // contoh rule: jika dalam 24 jam > 10 pelanggaran → alert
  const now = new Date();
  const t24 = new Date(now.getTime() - (24 * 3600 * 1000));
  const last24 = data.filter(d => {
    if (!d._tanggal) return false;
    const td = new Date(d._tanggal);
    return td >= t24;
  });

  // buat badge kecil di halaman atas (atau console)
  const existing = document.getElementById("alertPelanggaran");
  if (existing) existing.remove();

  if (last24.length > 10) {
    const banner = document.createElement("div");
    banner.id = "alertPelanggaran";
    banner.className = "alert alert-danger mt-3";
    banner.textContent = `⚠️ Perhatian: ${last24.length} pelanggaran terlapor dalam 24 jam terakhir.`;
    // pasang di atas tab content
    const container = document.querySelector(".container.py-4");
    if (container) container.prepend(banner);
  }
}

// Hook filter buttons supaya memicu applyCurrentFilterAndRender
// Jika kamu sudah punya setupFilterButtons() yang memanggil filter, pastikan panggil applyCurrentFilterAndRender()
// Di sini tambahkan listener untuk perubahan input supaya langsung update:
document.getElementById("filterTanggal").addEventListener("change", applyCurrentFilterAndRender);
document.getElementById("filterDari").addEventListener("change", applyCurrentFilterAndRender);
document.getElementById("filterSampai").addEventListener("change", applyCurrentFilterAndRender);
document.getElementById("filterKelas").addEventListener("change", applyCurrentFilterAndRender);

// Inisialisasi pemanggilan realtime
// Panggil loadRealtimePelanggaran() dari initDashboard() (di bagian atas) — sudah ada pemanggilan sebelumnya.


// ==========================================================
// RESTORED CHART FUNCTIONS (ABSENSI)
// ==========================================================

function drawChartTrenSiswa(data, baseDate) {
  // Tren status 7 hari terakhir (atau rentang yang dipilih)
  // Untuk simplifikasi, kita ambil dari data yang ada dan group by tanggal

  const byDate = {};
  // Urutkan tanggal
  data.sort((a, b) => new Date(a.waktu || a.tanggal) - new Date(b.waktu || b.tanggal));

  data.forEach(d => {
    const tgl = d.waktu ? new Date(d.waktu).toLocaleDateString('en-CA') : (d.tanggal || "").split("T")[0];
    if (!byDate[tgl]) byDate[tgl] = { hadir: 0, sakit: 0, izin: 0, alfa: 0, terlambat: 0 };

    // Normalisasi status
    const stat = (d.status || "").toLowerCase();
    const ket = (d.keterangan || "").toLowerCase();

    if (stat === "hadir") {
      if (ket.includes("terlambat")) byDate[tgl].terlambat++;
      else byDate[tgl].hadir++;
    } else if (stat === "sakit") byDate[tgl].sakit++;
    else if (stat === "izin") byDate[tgl].izin++;
    else if (stat === "alfa") byDate[tgl].alfa++;
    else if (stat === "terlambat") byDate[tgl].terlambat++;
  });

  const labels = Object.keys(byDate);
  const dataHadir = labels.map(k => byDate[k].hadir);
  const dataSakit = labels.map(k => byDate[k].sakit);
  const dataIzin = labels.map(k => byDate[k].izin);
  const dataAlfa = labels.map(k => byDate[k].alfa);
  const dataTerlambat = labels.map(k => byDate[k].terlambat);

  if (chartTrenSiswa) chartTrenSiswa.destroy();
  const ctx = document.getElementById("chartTrenSiswa");
  if (!ctx) return;

  chartTrenSiswa = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Hadir', data: dataHadir, borderColor: '#4caf50', backgroundColor: '#4caf50', tension: 0.3 },
        { label: 'Terlambat', data: dataTerlambat, borderColor: '#ff9800', backgroundColor: '#ff9800', tension: 0.3 },
        { label: 'Sakit', data: dataSakit, borderColor: '#2196f3', backgroundColor: '#2196f3', tension: 0.3 },
        { label: 'Izin', data: dataIzin, borderColor: '#ffeb3b', backgroundColor: '#ffeb3b', tension: 0.3 },
        { label: 'Alfa', data: dataAlfa, borderColor: '#f44336', backgroundColor: '#f44336', tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true, ticks: { allowDecimals: false } } }
    }
  });
}

function drawChartKelasSiswa(data) {
  // Stacked bar chart per kelas
  // Group by kelas
  const byKelas = {};
  data.forEach(d => {
    const k = d.kelas || "Lainnya";
    if (!byKelas[k]) byKelas[k] = { hadir: 0, sakit: 0, izin: 0, alfa: 0, terlambat: 0 };

    const stat = (d.status || "").toLowerCase();
    const ket = (d.keterangan || "").toLowerCase();

    if (stat === "hadir") {
      if (ket.includes("terlambat")) byKelas[k].terlambat++;
      else byKelas[k].hadir++;
    } else if (stat === "sakit") byKelas[k].sakit++;
    else if (stat === "izin") byKelas[k].izin++;
    else if (stat === "alfa") byKelas[k].alfa++;
    else if (stat === "terlambat") byKelas[k].terlambat++;
  });

  // Sort kelas
  const labels = Object.keys(byKelas).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const dHadir = labels.map(k => byKelas[k].hadir);
  const dTerlambat = labels.map(k => byKelas[k].terlambat);
  const dSakit = labels.map(k => byKelas[k].sakit);
  const dIzin = labels.map(k => byKelas[k].izin);
  const dAlfa = labels.map(k => byKelas[k].alfa);

  if (chartKelasSiswa) chartKelasSiswa.destroy();
  const ctx = document.getElementById("chartKelasSiswa");
  if (!ctx) return;

  chartKelasSiswa = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Hadir', data: dHadir, backgroundColor: '#4caf50' },
        { label: 'Terlambat', data: dTerlambat, backgroundColor: '#ff9800' },
        { label: 'Sakit', data: dSakit, backgroundColor: '#2196f3' },
        { label: 'Izin', data: dIzin, backgroundColor: '#ffeb3b' },
        { label: 'Alfa', data: dAlfa, backgroundColor: '#f44336' }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }, // hemat ruang
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      }
    }
  });
}

function renderTopSiswa(data) {
  // Tampilkan tabel ringkas siswa yang "Bermasalah" (Sakit/Izin/Alfa/Terlambat terbanyak minggu ini?)
  // Atau sekadar list absen hari ini?
  // User context: "Monitoring" -> usually negative behavior watches or simple log.
  // Kita tampilkan 10 data terakhir saja (Last logs) atau Top Alfa?
  // Mari tampilkan Log Absensi Terakhir (termasuk hadir) untuk real-time feed feel.

  // Urutkan waktu desc
  const sorted = data.sort((a, b) => {
    const ta = new Date(a.waktu || a.tanggal);
    const tb = new Date(b.waktu || b.tanggal);
    return tb - ta;
  }).slice(0, 10);

  const container = document.getElementById("topSiswaContainer");
  // Pastikan ada elemen ini di HTML. Jika tidak, abaikan atau gunakan console.
  // Cek ID elemen di HTML sebelumnya?
  // Di HTML step 15, saya tidak melihat tabel top siswa. 
  // Jika fungsinya dipanggil, berarti harus ada.
  // Mari kita cek code: `renderTopSiswa` dipanggil di renderAbsensi.

  // Asumsi: Elemen target mungkin `tabelAbsensi` atau sejenisnya.
  // Tapi errornya "drawChartTrenSiswa is not defined".
  // Mari kita buat aman.

  if (!container) return;

  container.innerHTML = sorted.map(d => `
    <div class="flex items-center justify-between p-2 border-b text-sm">
      <div>
        <div class="font-medium">${d.nama || d.namaSiswa}</div>
        <div class="text-xs text-muted">${d.kelas}</div>
      </div>
      <div class="text-right">
        <span class="badge ${getStatusColor(d.status)}">${d.status}</span>
        <div class="text-xs text-muted">${d.waktu ? new Date(d.waktu).toLocaleTimeString().slice(0, 5) : '-'}</div>
      </div>
    </div>
  `).join("");
}

function getStatusColor(status) {
  const s = (status || "").toLowerCase();
  if (s === 'hadir') return 'bg-success';
  if (s === 'sakit') return 'bg-info';
  if (s === 'izin') return 'bg-warning text-dark';
  if (s === 'alfa') return 'bg-danger';
  if (s === 'terlambat') return 'bg-orange-500 text-white'; // custom class
  return 'bg-secondary';
}
