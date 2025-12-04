// ==========================================================
// Dashboard Kepala Sekolah (Final Fix)
// ==========================================================
import {
  db, auth, onAuthStateChanged, signOut,
  collection, onSnapshot, getDocs, query, where, orderBy
} from "../firebase_init.js";

let chartTrenSiswa, chartKelasSiswa, chartJurnalGuru;
let selectedTanggal = new Date().toISOString().split("T")[0];
let selectedKelas = "";
let unsubscribeAbsensi = null; // Untuk hentikan listener lama

// ==========================================================
// LOGIN DAN INISIALISASI
// ==========================================================
onAuthStateChanged(auth, user => {
  if (!user) return (window.location.href = "../index.html");
  document.getElementById("namaUser").textContent = user.email;
  document.getElementById("loadingOverlay").style.display = "none";
  initDashboard();
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./index.html";
});

// ==========================================================
// INISIALISASI DASHBOARD
// ==========================================================
function initDashboard() {
  setupTabNavigation();
  loadKelasDropdown();
  loadRealtimeGuru();
  loadRealtimeAbsensi(getTodayDate()); // 🔥 panggil awal otomatis
  loadRealtimePelanggaran();
  verifySyncWithAbsensi();

  // Pasang event listener setelah DOM siap
  setupFilterButtons();
}


// ==========================================================
// CEK TAB AKTIF
// ==========================================================
function activeTab() {
  return document.querySelector(".tab-pane.active")?.id || "";
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
    alert("Pilih tanggal terlebih dahulu!");
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
    alert("Pilih kedua tanggal terlebih dahulu!");
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
function setupTabNavigation() {
  const tabs = document.querySelectorAll("#tabNav .nav-link");
  const contents = document.querySelectorAll(".tab-content > div");

  tabs.forEach(tab => {
    tab.addEventListener("click", e => {
      e.preventDefault();
      tabs.forEach(t => t.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));

      tab.classList.add("active");
      const targetId = "tab" + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
      const target = document.getElementById(targetId);
      if (target) target.classList.add("active");
    });
  });
}

// ==========================================================
// DROPDOWN KELAS
// ==========================================================
function loadKelasDropdown() {
  onSnapshot(collection(db, "absensi"), snapshot => {
    const allKelas = new Set(snapshot.docs.map(doc => doc.data().kelas));
    const sel = document.getElementById("filterKelas");
    sel.innerHTML = `<option value="">Semua Kelas</option>`;
    allKelas.forEach(kelas => {
      if (kelas) sel.innerHTML += `<option value="${kelas}">${kelas}</option>`;
    });
  });
}

// ==========================================================
// UTILITAS: TANGGAL HARI INI
// ==========================================================
function getTodayDate() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

// ==========================================================
// REALTIME ABSENSI (Per Tanggal)
// ==========================================================
function loadRealtimeAbsensi(selectedTanggal = new Date()) {
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
  unsubscribeAbsensi = onSnapshot(q, snapshot => renderAbsensi(snapshot, startOfDay));
}

// ==========================================================
// ABSENSI RENTANG TANGGAL
// ==========================================================
function loadAbsensiRentangTanggal(dari, sampai) {
  if (!dari || !sampai) {
    alert("Pilih kedua tanggal terlebih dahulu!");
    return;
  }

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
  unsubscribeAbsensi = onSnapshot(q, snapshot => renderAbsensi(snapshot, start));
}

// ==========================================================
// SEMUA ABSENSI
// ==========================================================
function loadRealtimeAbsensiSemua() {
  const q = query(collection(db, "absensi"), orderBy("waktu", "asc"));
  console.log("📡 Menampilkan semua data absensi");

  if (unsubscribeAbsensi) unsubscribeAbsensi();
  unsubscribeAbsensi = onSnapshot(q, snapshot => renderAbsensi(snapshot, new Date()));
}

// ==========================================================
// RENDER ABSENSI + GRAFIK
// ==========================================================
function renderAbsensi(snapshot, baseDate) {
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

  // Hitung total
  const total = new Set(dataFiltered.map(d => d.id_siswa)).size;
  const hadir = dataFiltered.filter(d => d.status === "hadir" && !d.keterangan.includes("terlambat")).length;
  const terlambat = dataFiltered.filter(d =>
    d.status === "terlambat" || (d.status === "hadir" && d.keterangan.includes("terlambat"))
  ).length;
  const izin = dataFiltered.filter(d => d.status === "izin").length;
  const sakit = dataFiltered.filter(d => d.status === "sakit").length;
  const alfa = dataFiltered.filter(d => d.status === "alfa").length;

  document.getElementById("totalSiswa").textContent = total;
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

// ==========================================================
// GRAFIK & TABEL SISWA
// ==========================================================
function drawChartTrenSiswa(data, baseDate) {
  const base = new Date(baseDate);
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const str = d.toISOString().split("T")[0];
    last7Days.push(str);
  }

  const byDate = {};
  last7Days.forEach(date => (byDate[date] = 0));
  data.forEach(d => {
    const tgl = d.waktu ? d.waktu.toISOString().split("T")[0] : null;
    if (
      last7Days.includes(tgl) &&
      (d.status === "terlambat" || (d.status === "hadir" && d.keterangan.includes("terlambat")))
    ) {
      byDate[tgl] = (byDate[tgl] || 0) + 1;
    }
  });

  if (chartTrenSiswa) chartTrenSiswa.destroy();
  chartTrenSiswa = new Chart(document.getElementById("chartTrenSiswa"), {
    type: "line",
    data: {
      labels: last7Days,
      datasets: [{ label: "Terlambat", data: last7Days.map(d => byDate[d] || 0), borderColor: "#dc3545", borderWidth: 2, fill: false }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function drawChartKelasSiswa(data) {
  const kelasCount = {};
  data.forEach(d => {
    if (d.status === "terlambat" || (d.status === "hadir" && d.keterangan.includes("terlambat"))) {
      kelasCount[d.kelas] = (kelasCount[d.kelas] || 0) + 1;
    }
  });

  const sorted = Object.entries(kelasCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const labels = sorted.map(d => d[0]);
  const values = sorted.map(d => d[1]);

  if (chartKelasSiswa) chartKelasSiswa.destroy();
  chartKelasSiswa = new Chart(document.getElementById("chartKelasSiswa"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Terlambat", data: values, backgroundColor: "#0d6efd" }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function renderTopSiswa(data) {
  const count = {};
  data.forEach(d => {
    if (d.status === "terlambat" || (d.status === "hadir" && d.keterangan.includes("terlambat"))) {
      const key = `${d.nama}-${d.kelas}`;
      count[key] = (count[key] || 0) + 1;
    }
  });

  const sorted = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const tbody = document.querySelector("#tabelSiswa tbody");
  tbody.innerHTML = sorted.map((d, i) => {
    const [nama, kelas] = d[0].split("-");
    return `<tr><td>${i + 1}</td><td>${nama}</td><td>${kelas}</td><td>${d[1]}</td></tr>`;
  }).join("");
}

// ==========================================================
// SINKRON STATUS
// ==========================================================
async function verifySyncWithAbsensi() {
  const snap = await getDocs(collection(db, "absensi"));
  const data = snap.docs.map(d => d.data());
  const today = new Date().toISOString().split("T")[0];
  const count = data.filter(d => d.tanggal_string === today).length;

  const banner = document.getElementById("syncStatus");
  const info = document.getElementById("syncInfo");
  if (!banner || !info) return;

  if (count > 0) {
    banner.classList.remove("alert-danger");
    banner.classList.add("alert-success");
    info.textContent = `${count} data absensi untuk ${today}`;
  } else {
    banner.classList.remove("alert-success");
    banner.classList.add("alert-danger");
    info.textContent = `Tidak ada data absensi untuk ${today}`;
  }
}

// ==========================================================
// MONITORING GURU
// ==========================================================
// ==========================================================
// 📘 REALTIME MONITORING GURU (Sinkron dengan Jurnal Guru + Filter Tanggal & Rentang)
// ==========================================================
import { doc, getDoc } from "../firebase_init.js"; // pastikan sudah ada di import paling atas

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

let unsubscribeGuru = null;

function loadRealtimeGuru(dariTanggal = null, sampaiTanggal = null) {
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
    const totalGuruUnik = new Set(data.map((d) => d.uid)).size;

    const isiHariIni = new Set(data.map((d) => d.uid)).size;
    const persenPatuh = totalGuruUnik > 0 ? Math.round((isiHariIni / totalGuruUnik) * 100) : 0;

    document.getElementById("totalGuru").textContent = totalGuruUnik;
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
// PELANGGARAN SISWA (Premium)
// ==========================================================
let chartPelanggaran, chartJenisPelanggaran, chartTrendPelanggaran;
let modalPelanggaran = null;

function toISODate(d) {
  // terima Date object atau string atau Firestore timestamp-like
  if (!d) return null;
  if (d.toDate) d = d.toDate(); // firestore Timestamp
  if (d instanceof Date) return d.toISOString().slice(0,10);
  // jika string, coba potong menjadi yyyy-mm-dd bila ada
  if (typeof d === "string") {
    // format: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS'
    return d.slice(0,10);
  }
  return null;
}

function parseCreatedAt(d) {
  // mengembalikan string yyyy-mm-dd atau null
  return toISODate(d && (d.createdAt !== undefined ? d.createdAt : d));
}

// Ambil pelanggaran (dibatasi untuk performa)
function loadRealtimePelanggaran() {
  // Ambil 6 bulan terakhir untuk berjaga-jaga (atau gunakan filter bulan ini)
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - 6);
  start.setHours(0,0,0,0);

  // prefer createdAt sebagai string; jika di Firestore timestamp, onSnapshot masih ambil semua dan kita filter di client
  const q = query(collection(db, "pelanggaran"), orderBy("createdAt", "desc"));
  onSnapshot(q, async snapshot => {
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

    // simpan snapshot global (opsional) dan render
    window.__pelanggaranCache = allData;
    applyCurrentFilterAndRender();
    console.log("🔥 Pelanggaran realtime ter-update:", allData.length);
  });
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
    start.setHours(0,0,0,0); end.setHours(23,59,59,999);
    filtered = filtered.filter(d => {
      const t = d._tanggal ? new Date(d._tanggal) : null;
      return t && t >= start && t <= end;
    });
  } else {
    // default: bulan ini
    const thisMonth = new Date().toISOString().slice(0,7);
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
  const bulanIni = new Date().toISOString().slice(0,7);
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

  const kelasEntries = Object.entries(kelasCount).sort((a,b) => b[1]-a[1]);
  const kelasTertinggi = kelasEntries.length ? kelasEntries[0][0] : "-";

  // rata-rata per kelas
  const rata = kelasEntries.length ? (total / kelasEntries.length) : 0;

  // siswa tertinggi poin
  const siswaEntries = Object.entries(siswaPoint).sort((a,b) => b[1]-a[1]);
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
  data.sort((a,b) => (b._tanggal || "").localeCompare(a._tanggal || ""));

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
    data: { labels, datasets: [{ label: "Jumlah", data: values, backgroundColor: [
  "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF",
  "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF"
]
 }] },
    options: {
      plugins: { legend:{ display:false } },
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
    data: { labels, datasets: [{ data: values, backgroundColor: [
  "#4D96FF", "#6BCB77", "#FFD93D", "#FF6B6B",
  "#845EC2", "#FF9671", "#FFC75F"
]
 }] },
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
    days.push(d.toISOString().slice(0,10));
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
    label:"Pelanggaran",
    data: values,
    borderColor:"#FF6B6B",        // warna garis pastel
    pointBackgroundColor: "#FF6B6B",
    pointBorderColor: "#ffffff",
    pointRadius: 4,
    tension: 0.4,
    fill: false
  }] 
},
    options: { plugins:{ legend:{ display:false } }, scales: { y:{ beginAtZero:true } } }
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

  if (!modalPelanggaran) modalPelanggaran = new bootstrap.Modal(document.getElementById('modalPelanggaranDetail'));
  modalPelanggaran.show();
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
        <td>${d.namaSiswa||'-'}</td>
        <td>${d.kelas||'-'}</td>
        <td>${d.jenis||'-'}</td>
        <td>${d.kategori||'-'}</td>
        <td>${d._poin||0}</td>
        <td>${d._tanggal||'-'}</td>
        <td>${d.keterangan||'-'}</td>
      </tr>
    `).join("");
    document.getElementById("modalPelanggaranIsi").innerHTML = `
      <div class="table-responsive"><table class="table table-sm">
        <thead><tr><th>Nama</th><th>Kelas</th><th>Jenis</th><th>Kategori</th><th>Poin</th><th>Tanggal</th><th>Keterangan</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    `;
  }
  if (!modalPelanggaran) modalPelanggaran = new bootstrap.Modal(document.getElementById('modalPelanggaranDetail'));
  modalPelanggaran.show();
}

// Alerts otomatis (contoh simple)
function updateAlerts(data) {
  // contoh rule: jika dalam 24 jam > 10 pelanggaran → alert
  const now = new Date();
  const t24 = new Date(now.getTime() - (24*3600*1000));
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

