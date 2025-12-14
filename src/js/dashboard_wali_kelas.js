// ===============================
// dashboard_wali_kelas.js — Final
// ===============================

import {
  db, auth, onAuthStateChanged, signOut,
  collection, query, where, onSnapshot, orderBy, getDocs
} from "./firebase_init.js";
import { renderNavbar } from "./components/Navbar.js";
import { renderSidebar } from "./components/Sidebar.js";


/* DOM */
const namaWaliEl = document.getElementById("namaWali");
const statusBanner = document.getElementById("statusBanner");
const filterKelasEl = document.getElementById("filterKelas");
const filterSiswaEl = document.getElementById("filterSiswa");
const filterTanggalMulai = document.getElementById("filterTanggalMulai");
const filterTanggalAkhir = document.getElementById("filterTanggalAkhir");
const inputCari = document.getElementById("inputCari");
const btnRefresh = document.getElementById("btnRefresh");
const btnExportExcel = document.getElementById("btnExportExcel");
const btnExportPDF = document.getElementById("btnExportPDF");
const btnPrint = document.getElementById("btnPrint");

const summaryAbsensi = document.getElementById("summaryAbsensi");
const summaryPelanggaran = document.getElementById("summaryPelanggaran");
const modalDetailEl = document.getElementById("modalDetail");
const modalTitle = document.getElementById("modalTitle");
const detailContent = document.getElementById("detailContent");
const chartDetailCanvas = document.getElementById("chartDetail");
const chartAbsensiCtx = document.getElementById("chartAbsensi");
const chartPelanggaranCtx = document.getElementById("chartPelanggaran");
const printArea = document.getElementById("printArea");
const btnLogout = document.getElementById("btnLogout");

/* Views */
const views = {
  absensi: document.getElementById('viewAbsensi'),
  pelanggaran: document.getElementById('viewPelanggaran'),
  catatan: document.getElementById('viewCatatan')
};
let currentView = 'absensi';

/* charts */
let chartAbsensi = null;
let chartPelanggaran = null;
let chartDetail = null;
let chartTrenAbsensi = null;
let chartTrenPelanggaran = null;


/* data caches */
let siswaList = [];
let absensiList = [];
let pelanggaranList = [];
let catatanList = [];
let kelasList = [];

// Expose showDetail globally
window.showDetail = showDetail;

/* pagination */
let absensiPage = 1;
let pelanggaranPage = 1;
const rowsPerPage = 10;

/* small logger */
const L = (...a) => console.log("[WALI]", ...a);

/* helper parse firestore timestamp -> yyyy-mm-dd (Robust) */
function toISODate(input) {
  if (!input) return null;
  try {
    const d = input?.toDate ? input.toDate() : new Date(input);
    if (isNaN(d.getTime())) return null; // Invalid date
    return d.toISOString().split("T")[0];
  } catch (e) {
    return null;
  }
}

/* helper switch view */
function switchView(viewName) {
  currentView = viewName;
  Object.values(views).forEach(el => el && el.classList.add('hidden'));
  if (views[viewName]) views[viewName].classList.remove('hidden');

  // Re-render needed charts if visible
  if (viewName === 'absensi') {
    renderAbsensiChart();
    renderTrenAbsensiMingguan();
  } else if (viewName === 'pelanggaran') {
    renderPelanggaranChart();
    renderTrenPelanggaranMingguan();
  } else if (viewName === 'catatan') {
    renderTableCatatan();
  }
}

/* logout */
if (btnLogout) {
  // ... existing logout ...
  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
    localStorage.removeItem("userData");
    window.location.href = "index.html";
  });
  btnLogout.addEventListener("touchstart", (e) => { e.preventDefault(); btnLogout.click(); }, { passive: false });
}

/* helper: set banner */
function setStatus(msg, type = "info") {
  statusBanner.textContent = msg;
  // Tailwind alert styles
  const styles = {
    info: "p-4 mb-4 text-blue-700 bg-blue-100 rounded-lg dark:bg-blue-200 dark:text-blue-800",
    success: "p-4 mb-4 text-green-700 bg-green-100 rounded-lg dark:bg-green-200 dark:text-green-800",
    warning: "p-4 mb-4 text-yellow-700 bg-yellow-100 rounded-lg dark:bg-yellow-200 dark:text-yellow-800",
    danger: "p-4 mb-4 text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800"
  };
  statusBanner.className = styles[type] || styles.info;
}

/* helper parse firestore timestamp -> yyyy-mm-dd */

/* fill kelas & siswa dropdowns */
function fillKelas() {
  const uniq = Array.from(new Set(kelasList.filter(Boolean))).sort();
  filterKelasEl.innerHTML = `<option value="">Semua Kelas</option>${uniq.map(k => `<option value="${k}">${k}</option>`).join("")}`;
}
function fillSiswa(kelas = "") {
  const list = kelas ? siswaList.filter(s => s.kelas === kelas) : siswaList;
  const uniq = Array.from(new Set(list.map(s => s.nama))).sort();
  filterSiswaEl.innerHTML = `<option value="">Semua Siswa</option>${uniq.map(n => `<option value="${n}">${n}</option>`).join("")}`;
}

/* ----------------------------
   Render tabel terpisah + pagination
   ---------------------------- */

function renderTableAbsensi() {
  const kelas = filterKelasEl.value;
  const siswa = filterSiswaEl.value;
  const body = document.getElementById("bodyAbsensi");
  const pagDiv = document.getElementById("pagAbsensi");

  let rows = absensiList.filter(a => {
    if (kelas && a.kelas !== kelas) return false;
    if (siswa && a.nama !== siswa) return false;
    return true;
  });

  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Tidak ada data</td></tr>`;
    if (pagDiv) pagDiv.innerHTML = "";
    return;
  }

  // pagination compute
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  if (absensiPage > totalPages) absensiPage = totalPages;
  if (absensiPage < 1) absensiPage = 1;

  const start = (absensiPage - 1) * rowsPerPage;
  const pageRows = rows.slice(start, start + rowsPerPage);

  // render rows
  body.innerHTML = "";
  pageRows.forEach((a, i) => {
    const t = a.waktu?.toDate ? a.waktu.toDate() : (a.waktu ? new Date(a.waktu) : null);
    const waktuStr = t ? t.toLocaleString("id-ID") : "-";
    body.innerHTML += `
      <tr class="bg-white border-b hover:bg-gray-50">
        <td class="px-6 py-4">${start + i + 1}</td>
        <td class="px-6 py-4 font-medium text-gray-900">${a.nama}</td>
        <td class="px-6 py-4">${a.kelas || "-"}</td>
        <td class="px-6 py-4">
            <span class="${a.status === 'Hadir' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'} text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
            ${a.status || "-"}
            </span>
        </td>
        <td class="px-6 py-4">${a.keterangan || "-"}</td>
        <td class="px-6 py-4">${waktuStr}</td>
      </tr>
    `;
  });

  // pagination buttons
  if (pagDiv) {
    pagDiv.innerHTML = `
      <button class="btn btn-sm btn-outline-primary me-2" ${absensiPage === 1 ? "disabled" : ""} onclick="absensiPage--; renderTableAbsensi()">⬅️ Prev</button>
      <span class="mx-2">Halaman ${absensiPage} / ${totalPages}</span>
      <button class="btn btn-sm btn-outline-primary ms-2" ${absensiPage === totalPages ? "disabled" : ""} onclick="absensiPage++; renderTableAbsensi()">Next ➡️</button>
    `;
  }
}

function renderTablePelanggaran() {
  const kelas = filterKelasEl.value;
  const siswa = filterSiswaEl.value;
  const body = document.getElementById("bodyPelanggaran");
  const pagDiv = document.getElementById("pagPelanggaran");

  let rows = pelanggaranList.filter(p => {
    if (kelas && p.kelas !== kelas) return false;
    const n = p.namaSiswa || p.nama || "Unidentified";
    if (siswa && n !== siswa) return false;
    return true;
  });

  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Tidak ada data</td></tr>`;
    if (pagDiv) pagDiv.innerHTML = "";
    return;
  }

  // total poin per siswa (dihitung pada seluruh row match filter)
  const totalPoin = {};
  rows.forEach(p => {
    const n = p.namaSiswa || p.nama || "Unidentified";
    totalPoin[n] = (totalPoin[n] || 0) + (Number(p.poin) || 0);
  });

  // pagination compute
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  if (pelanggaranPage > totalPages) pelanggaranPage = totalPages;
  if (pelanggaranPage < 1) pelanggaranPage = 1;

  const start = (pelanggaranPage - 1) * rowsPerPage;
  const pageRows = rows.slice(start, start + rowsPerPage);

  // render rows
  body.innerHTML = "";
  pageRows.forEach((p, i) => {
    const t = p.tanggal?.toDate ? p.tanggal.toDate() : (p.tanggal ? new Date(p.tanggal) : null);
    const tanggalStr = t ? t.toLocaleString("id-ID") : "-";
    const namaSiswa = p.namaSiswa || p.nama || "Unidentified";
    const total = totalPoin[namaSiswa] || 0;

    // color by total points thresholds — ubah threshold sesuai kebijakan
    let kelasRow = "bg-white border-b hover:bg-gray-50";
    let textClass = "text-gray-500";

    if (total >= 50) { kelasRow = "bg-red-50 border-b hover:bg-red-100"; textClass = "text-red-700"; }
    else if (total >= 30) { kelasRow = "bg-yellow-50 border-b hover:bg-yellow-100"; textClass = "text-yellow-700"; }
    else if (total >= 15) { kelasRow = "bg-blue-50 border-b hover:bg-blue-100"; textClass = "text-blue-700"; }

    body.innerHTML += `
      <tr class="${kelasRow} cursor-pointer" onclick="showDetail('${namaSiswa}')">
        <td class="px-6 py-4">${start + i + 1}</td>
        <td class="px-6 py-4 font-medium text-gray-900">${namaSiswa}</td>
        <td class="px-6 py-4">${p.kelas || "-"}</td>
        <td class="px-6 py-4">${p.jenis || p.jenis_pelanggaran || "-"}</td>
        <td class="px-6 py-4 font-bold ${textClass}">${Number(p.poin) || 0}</td>
        <td class="px-6 py-4">${p.keterangan || "-"}</td>
        <td class="px-6 py-4">${tanggalStr}</td>
      </tr>
    `;
  });

  // pagination buttons
  if (pagDiv) {
    pagDiv.innerHTML = `
      <button class="btn btn-sm btn-outline-primary me-2" ${pelanggaranPage === 1 ? "disabled" : ""} onclick="pelanggaranPage--; renderTablePelanggaran()">⬅️ Prev</button>
      <span class="mx-2">Halaman ${pelanggaranPage} / ${totalPages}</span>
      <button class="btn btn-sm btn-outline-primary ms-2" ${pelanggaranPage === totalPages ? "disabled" : ""} onclick="pelanggaranPage++; renderTablePelanggaran()">Next ➡️</button>
    `;
  }
}


function renderTableCatatan() {
  const body = document.getElementById("bodyCatatan");
  if (!body) return; // if view not ready

  const kelas = filterKelasEl.value;
  // Catatan biasanya per kelas, tidak per siswa, tapi bisa di filter
  let rows = catatanList.filter(c => {
    if (kelas && c.kelas !== kelas) return false;
    return true;
  });

  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Tidak ada catatan</td></tr>`;
    return;
  }

  // Sort by date desc
  rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  body.innerHTML = "";
  rows.forEach((c, i) => {
    const t = c.createdAt ? new Date(c.createdAt).toLocaleDateString('id-ID') : '-';
    body.innerHTML += `
      <tr class="bg-white border-b hover:bg-gray-50">
        <td class="px-6 py-4">${i + 1}</td>
        <td class="px-6 py-4 font-mono text-sm">${t}</td>
        <td class="px-6 py-4 font-semibold">${c.guru || 'Guru'}</td>
        <td class="px-6 py-4">${c.catatan || '-'}</td>
        <td class="px-6 py-4 text-center">
            ${c.penting ? '<i class="bi bi-star-fill text-yellow-500"></i>' : '-'}
        </td>
      </tr>
    `;
  });
}

/* charts rendering */
function renderAbsensiChart() {
  // counts by status (applies current filters)
  const kelas = filterKelasEl.value;
  const nama = filterSiswaEl.value;
  const tStart = filterTanggalMulai.value;
  const tEnd = filterTanggalAkhir.value;

  let rows = absensiList.filter(a => {
    if (kelas && a.kelas !== kelas) return false;
    if (nama && a.nama !== nama) return false;
    if (tStart || tEnd) {
      const d = a.waktu?.toDate ? a.waktu.toDate() : (a.waktu ? new Date(a.waktu) : null);
      if (!d) return false;
      const iso = d.toISOString().split("T")[0];
      if (tStart && iso < tStart) return false;
      if (tEnd && iso > tEnd) return false;
    }
    return true;
  });

  const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0, Terlambat: 0 };
  rows.forEach(r => {
    const st = (r.status || "hadir").toLowerCase();
    if (st.includes("izin")) counts.Izin++;
    else if (st.includes("sakit")) counts.Sakit++;
    else if (st.includes("alfa")) counts.Alfa++;
    else counts.Hadir++;
    if ((r.keterangan || "").toLowerCase().includes("terlambat")) counts.Terlambat++;
  });

  const labels = ["Hadir", "Izin", "Sakit", "Alfa", "Terlambat"];
  const data = labels.map(l => counts[l]);

  if (chartAbsensi) chartAbsensi.destroy();
  chartAbsensi = new Chart(chartAbsensiCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Jumlah",
        data,
        backgroundColor: [
          "#6EC1E4", // biru pastel
          "#F7B801", // kuning lembut
          "#F35B04", // oranye pastel
          "#D7263D", // merah soft
          "#2E86AB"  // biru elegan
        ],
        borderRadius: 10,
        hoverBackgroundColor: [
          "#5AB0D2",
          "#E5A700",
          "#D94E00",
          "#C11D34",
          "#1F6E8A"
        ]
      }]
    },
    options: {
      responsive: true,

      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: "rgba(0,0,0,0.7)",
          padding: 10,
          bodyFont: { size: 13 },
          titleFont: { size: 13 }
        }
      },

      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "#e2e8f0" // garis grid lembut
          },
          ticks: {
            font: { size: 12 }
          }
        },
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 12 }
          }
        }
      }
    }
  });
  summaryAbsensi.textContent = `Total catatan absensi (filter saat ini): ${rows.length}`;
}

function renderPelanggaranChart() {
  const kelas = filterKelasEl.value;
  const nama = filterSiswaEl.value;
  const tStart = filterTanggalMulai.value;
  const tEnd = filterTanggalAkhir.value;

  let rows = pelanggaranList.filter(p => {
    if (kelas && p.kelas !== kelas) return false;
    if (nama && p.nama !== nama) return false;
    if (tStart || tEnd) {
      const d = p.tanggal?.toDate ? p.tanggal.toDate() : (p.tanggal ? new Date(p.tanggal) : null);
      if (!d) return false;
      const iso = d.toISOString().split("T")[0];
      if (tStart && iso < tStart) return false;
      if (tEnd && iso > tEnd) return false;
    }
    return true;
  });

  const agg = {};
  rows.forEach(r => {
    const k = r.jenis || r.jenis_pelanggaran || "Lainnya";
    agg[k] = (agg[k] || 0) + 1;
  });

  const labels = Object.keys(agg);
  const data = Object.values(agg);

  if (chartPelanggaran) chartPelanggaran.destroy();
  chartPelanggaran = new Chart(chartPelanggaranCtx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        label: "Jumlah Pelanggaran",
        data,
        backgroundColor: [
          "#FF6B6B", // merah pastel
          "#FFA36C", // oranye pastel
          "#FFD93D", // kuning soft
          "#6BCB77", // hijau pastel
          "#4D96FF", // biru lembut
          "#9D4EDD"  // ungu pastel
        ],
        hoverOffset: 8,
        borderWidth: 2,
        borderColor: "#ffffff",
      }]
    },
    options: {
      responsive: true,
      cutout: "55%",  // ukuran lubang tengah — makin besar makin elegant

      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: "rgba(0,0,0,0.7)",
          padding: 10,
          bodyFont: { size: 13 },
          titleFont: { size: 13 }
        }
      },

      animation: {
        animateRotate: true,
        animateScale: true
      }
    }
  });


  summaryPelanggaran.textContent = `Total pelanggaran (filter saat ini): ${rows.length}`;
}

function renderTrenAbsensiMingguan() {
  // Ambil 7 hari terakhir
  const now = new Date();
  const days = [];
  const counts = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    days.push(iso);

    // hitung absensi pada tanggal itu
    const total = absensiList.filter(a => {
      const iso = toISODate(a.waktu);
      return iso && iso === days[i]; // Use helper
    }).length;

    counts.push(total);
  }

  if (chartTrenAbsensi) chartTrenAbsensi.destroy();

  chartTrenAbsensi = new Chart(document.getElementById("chartTrenAbsensi"), {
    type: "line",
    data: {
      labels: days,
      datasets: [{
        label: "Absensi / Hari",
        data: counts,
        tension: 0.4,
        fill: false,
        borderWidth: 3,
        borderColor: "#4D96FF",
        pointRadius: 4,
        pointBackgroundColor: "#4D96FF"
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function renderTrenPelanggaranMingguan() {
  const now = new Date();
  const days = [];
  const counts = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    days.push(iso);

    const total = pelanggaranList.filter(p => {
      const iso = toISODate(p.tanggal) || toISODate(p.createdAt); // Try both
      return iso && iso === days[i];
    }).length;

    counts.push(total);
  }

  if (chartTrenPelanggaran) chartTrenPelanggaran.destroy();

  chartTrenPelanggaran = new Chart(document.getElementById("chartTrenPelanggaran"), {
    type: "line",
    data: {
      labels: days,
      datasets: [{
        label: "Pelanggaran / Hari",
        data: counts,
        tension: 0.4,
        fill: true,
        borderColor: "#FF6B6B",
        backgroundColor: "rgba(255, 107, 107, 0.25)",
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: "#FF6B6B"
      }]
    },
    options: {
      scales: { y: { beginAtZero: true } }
    }
  });
}


/* show modal detail for a student */
function showDetail(nama) {
  modalTitle.textContent = `Detail: ${nama}`;
  const a = absensiList.filter(x => x.nama === nama);
  const p = pelanggaranList.filter(x => x.nama === nama);
  const c = catatanList.filter(x => x.nama === nama);

  let html = `<h6>Rekap Kehadiran (${a.length})</h6><ul>`;
  a.slice(0, 100).forEach(it => {
    const waktu = it.waktu?.toDate ? it.waktu.toDate().toLocaleString("id-ID") : (it.waktu ? new Date(it.waktu).toLocaleString() : '-');
    html += `<li>${waktu} — ${it.status || 'Hadir'} ${it.keterangan ? '- ' + it.keterangan : ''}</li>`;
  });
  html += `</ul><h6 class="mt-3">Pelanggaran (${p.length})</h6><ul>`;
  p.slice(0, 100).forEach(it => {
    const t = it.tanggal?.toDate ? it.tanggal.toDate().toLocaleString("id-ID") : (it.tanggal ? new Date(it.tanggal).toLocaleString() : '-');
    html += `<li>${t} — ${it.jenis || it.jenis_pelanggaran || '-'} ${it.poin ? ' (' + it.poin + ' poin)' : ''} ${it.keterangan ? '- ' + it.keterangan : ''}</li>`;
  });
  html += `</ul><h6 class="mt-3">Catatan Guru (${c.length})</h6><ul>`;
  c.slice(0, 100).forEach(it => {
    html += `<li><b>${it.guru || 'Guru'}</b>: ${it.catatan || '-'} <small class="text-muted">${it.tanggal || ''}</small></li>`;
  });
  html += `</ul>`;
  detailContent.innerHTML = html;

  // Calculate stats for chart
  let hadir = 0, izin = 0, sakit = 0, alfa = 0, terl = 0;
  a.forEach(at => {
    const st = (at.status || "").toLowerCase();
    if (st.includes("izin")) izin++;
    else if (st.includes("sakit")) sakit++;
    else if (st.includes("alfa")) alfa++;
    else hadir++;

    if ((at.keterangan || "").toLowerCase().includes("terlambat")) terl++;
  });

  // Show modal (remove hidden class)
  document.getElementById('modalDetail').classList.remove('hidden');

  // small doughnut
  // DOUGHNUT KECIL (Detail per Siswa)
  if (chartDetail) chartDetail.destroy();
  chartDetail = new Chart(chartDetailCanvas, {
    type: "doughnut",
    data: {
      labels: ["Hadir", "Izin", "Sakit", "Alfa", "Terlambat"],
      datasets: [{
        data: [hadir, izin, sakit, alfa, terl],
        backgroundColor: [
          "#6EC1E4", "#F7B801", "#F35B04", "#D7263D", "#2E86AB"
        ],
        borderWidth: 2,
        borderColor: "#fff",
        hoverOffset: 6
      }]
    },
    options: {
      cutout: "60%",
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });

}

/* exports (Excel / PDF) for current filtered table */
function gatherRowsFromTables() {
  const rows = [];
  // absensi
  const trsA = document.querySelectorAll("#bodyAbsensi tr");
  trsA.forEach(tr => {
    const cols = Array.from(tr.children).map(td => td.textContent.trim());
    if (cols.length === 6) rows.push(["Absensi", ...cols]); // prefix supaya tahu jenis
  });
  // pelanggaran
  const trsP = document.querySelectorAll("#bodyPelanggaran tr");
  trsP.forEach(tr => {
    const cols = Array.from(tr.children).map(td => td.textContent.trim());
    if (cols.length === 7) rows.push(["Pelanggaran", ...cols]);
  });
  return rows;
}

function exportExcelCurrent() {
  const rows = gatherRowsFromTables();
  if (!rows.length) return alert("Tidak ada data untuk di-export.");
  const header = ["Tipe", "No", "Nama", "Kelas", "Col4", "Col5", "Col6", "Col7"];
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap");
  XLSX.writeFile(wb, `Rekap_Wali_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportPDFCurrent() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');
  doc.setFontSize(12);
  doc.text("Rekap Wali Kelas", 14, 16);
  const rows = gatherRowsFromTables();
  if (!rows.length) return alert("Tidak ada data untuk di-export.");
  let y = 25;
  doc.setFontSize(9);
  rows.forEach(r => {
    doc.text(r.join(" | "), 14, y);
    y += 6;
    if (y > 180) { doc.addPage(); y = 20; }
  });
  doc.save(`Rekap_Wali_${new Date().toISOString().slice(0, 10)}.pdf`);
}


/* print friendly */
btnPrint.addEventListener("click", () => {
  let html = `<h3>Rekap Wali Kelas</h3><table border="1" style="width:100%; border-collapse: collapse;"><thead><tr><th>Tipe</th><th>No</th><th>Nama</th><th>Kelas</th><th>Col4</th><th>Col5</th><th>Col6</th></tr></thead><tbody>`;
  const rows = gatherRowsFromTables();
  rows.forEach(r => {
    const cols = r.map(c => `<td style="padding:6px">${c}</td>`).join("");
    html += `<tr>${cols}</tr>`;
  });
  html += `</tbody></table>`;
  printArea.innerHTML = html;
  window.print();
});


/* realtime subscriptions */
let unsubAbs = null, unsubPel = null, unsubCat = null;

/* load master siswa once (for dropdowns) */
async function loadMasterSiswa(kelasWali = "") {
  try {
    const q = query(collection(db, "siswa"));
    const snap = await getDocs(q);
    siswaList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    kelasList = Array.from(new Set(siswaList.map(s => s.kelas).filter(Boolean)));
    if (kelasWali && !kelasList.includes(kelasWali)) kelasList.unshift(kelasWali);
    fillKelas(); fillSiswa(kelasWali || "");
  } catch (err) { console.error("loadMasterSiswa:", err); }
}

/* attach realtime queries for a kelas (if kelas empty, listen none) */
function attachRealtime(kelas) {
  // cleanup
  if (unsubAbs) unsubAbs(); if (unsubPel) unsubPel(); if (unsubCat) unsubCat();

  // absensi
  if (kelas) {
    const qAbs = query(collection(db, "absensi"), where("kelas", "==", kelas));
    unsubAbs = onSnapshot(qAbs, snap => {
      absensiList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderTrenAbsensiMingguan();
    }, err => console.error("absensi onSnapshot:", err));
  } else {
    absensiList = []; renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderTrenAbsensiMingguan();
  }

  // pelanggaran_siswa
  if (kelas) {
    const qPel = query(collection(db, "pelanggaran"), where("kelas", "==", kelas));
    unsubPel = onSnapshot(qPel, snap => {
      pelanggaranList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTableAbsensi(); renderTablePelanggaran(); renderPelanggaranChart(); renderTrenPelanggaranMingguan();
    }, err => console.error("pelanggaran onSnapshot:", err));
  } else { pelanggaranList = []; renderTableAbsensi(); renderTablePelanggaran(); renderPelanggaranChart(); renderTrenPelanggaranMingguan(); }

  // catatan_kelas
  if (kelas) {
    const qCat = query(collection(db, "catatan_kelas"), where("kelas", "==", kelas));
    unsubCat = onSnapshot(qCat, snap => {
      catatanList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (currentView === 'catatan') renderTableCatatan();
    }, err => console.error("catatan onSnapshot:", err));
  } else { catatanList = []; }
}

/* INIT: auth & fallback localStorage */
onAuthStateChanged(auth, async (user) => {
  L("onAuthStateChanged =>", user ? "firebase user present" : "no firebase user");
  let userData = {};
  try { userData = JSON.parse(localStorage.getItem("userData") || "{}"); } catch (e) { userData = {}; }

  if (!user && (!userData || Object.keys(userData).length === 0)) {
    setStatus("Belum login. Mengarahkan ke halaman login...", "warning");
    setTimeout(() => window.location.href = "index.html", 800);
    return;
  }

  if (!userData.role) {
    // if role missing, attempt to default to wali_kelas if kelas present
    if (userData.kelasWali) userData.role = "wali_kelas";
  }

  if (!["wali_kelas", "guru"].includes((userData.role || "").toLowerCase())) {
    setStatus("Akses ditolak. Hanya wali kelas/guru.", "danger");
    setTimeout(() => { localStorage.removeItem("userData"); window.location.href = "index.html"; }, 1200);
    return;
  }

  // const namaWaliEl = document.getElementById("namaWaliEl"); // Removed or handled by Navbar
  const nama = userData.nama || user?.displayName || user?.email || "Wali Kelas";
  const kelasWali = userData.kelasWali || userData.kelas || "";

  // namaWaliEl.textContent = nama; // FIX: Prevent setting unchecked element
  setStatus(`Menampilkan data untuk kelas: ${kelasWali || "Pilih kelas"}`, "success");

  // Init Components
  renderNavbar({
    title: 'Dashboard Wali Kelas',
    userEmail: user.email,
    onLogout: async () => {
      await signOut(auth);
      localStorage.removeItem("userData");
      window.location.href = "index.html";
    }
  });

  renderSidebar([
    { id: 'menuAbsensi', label: 'Absensi', icon: '<i class="bi bi-calendar-check text-xl"></i>', onClick: () => switchView('absensi') },
    { id: 'menuPelanggaran', label: 'Pelanggaran', icon: '<i class="bi bi-exclamation-triangle text-xl"></i>', onClick: () => switchView('pelanggaran') },
    { id: 'menuCatatan', label: 'Catatan Kelas', icon: '<i class="bi bi-journal-text text-xl"></i>', onClick: () => switchView('catatan') }
  ]);

  await loadMasterSiswa(kelasWali);

  if (kelasWali) {
    filterKelasEl.value = kelasWali;
    fillSiswa(kelasWali);
    attachRealtime(kelasWali);
  } else {
    // no kelas assigned: user must pick
    attachRealtime(""); // no-op
  }
});

/* event handlers */
filterKelasEl.addEventListener("change", () => {
  const k = filterKelasEl.value;
  fillSiswa(k);
  attachRealtime(k);
  renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderPelanggaranChart(); renderTrenAbsensiMingguan(); renderTrenPelanggaranMingguan();
});
filterSiswaEl.addEventListener("change", () => { renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderPelanggaranChart(); });
filterTanggalMulai.addEventListener("change", () => { renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderPelanggaranChart(); });
filterTanggalAkhir.addEventListener("change", () => { renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderPelanggaranChart(); });
inputCari.addEventListener("input", () => { renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderPelanggaranChart(); });
btnRefresh.addEventListener("click", () => { renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderPelanggaranChart(); });
btnExportExcel.addEventListener("click", exportExcelCurrent);
btnExportPDF.addEventListener("click", exportPDFCurrent);

/* initial */
L("dashboard_wali_kelas.js loaded");
