// ===============================
// dashboard_wali_kelas.js — Final (dgn: rentang tanggal, search, export per siswa/kelas, print)
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore, collection, query, where, onSnapshot, orderBy, getDocs
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* CONFIG FIREBASE — sesuaikan jika perlu */
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
const tableBody = document.getElementById("tableBody");
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

/* pagination */
let absensiPage = 1;
let pelanggaranPage = 1;
const rowsPerPage = 10;

/* small logger */
const L = (...a) => console.log("[WALI]", ...a);

/* logout */
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
    localStorage.removeItem("userData");
    window.location.href = "index.html";
  });
  btnLogout.addEventListener("touchstart", (e)=> { e.preventDefault(); btnLogout.click(); }, { passive:false });
}

/* helper: set banner */
function setStatus(msg, type="info") {
  statusBanner.textContent = msg;
  statusBanner.className = `alert alert-${type}`;
}

/* helper parse firestore timestamp -> yyyy-mm-dd */
function toISODate(input) {
  const d = input?.toDate ? input.toDate() : (input ? new Date(input) : null);
  return d ? d.toISOString().split("T")[0] : null;
}

/* fill kelas & siswa dropdowns */
function fillKelas() {
  const uniq = Array.from(new Set(kelasList.filter(Boolean))).sort();
  filterKelasEl.innerHTML = `<option value="">Semua Kelas</option>${uniq.map(k=>`<option value="${k}">${k}</option>`).join("")}`;
}
function fillSiswa(kelas="") {
  const list = kelas ? siswaList.filter(s=>s.kelas===kelas) : siswaList;
  const uniq = Array.from(new Set(list.map(s=>s.nama))).sort();
  filterSiswaEl.innerHTML = `<option value="">Semua Siswa</option>${uniq.map(n=>`<option value="${n}">${n}</option>`).join("")}`;
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
      <tr>
        <td>${start + i + 1}</td>
        <td>${a.nama}</td>
        <td>${a.kelas || "-"}</td>
        <td>${a.status || "-"}</td>
        <td>${a.keterangan || "-"}</td>
        <td>${waktuStr}</td>
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
    if (siswa && p.nama !== siswa) return false;
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
    totalPoin[p.nama] = (totalPoin[p.nama] || 0) + (Number(p.poin) || 0);
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
    const total = totalPoin[p.nama] || 0;

    // color by total points thresholds — ubah threshold sesuai kebijakan
    let kelasRow = "";
    if (total >= 50) kelasRow = "table-danger";     // berat
    else if (total >= 30) kelasRow = "table-warning"; // sedang
    else if (total >= 15) kelasRow = "table-info";    // ringan

    body.innerHTML += `
      <tr class="${kelasRow}">
        <td>${start + i + 1}</td>
        <td>${p.nama}</td>
        <td>${p.kelas || "-"}</td>
        <td>${p.jenis || p.jenis_pelanggaran || "-"}</td>
        <td>${Number(p.poin) || 0}</td>
        <td>${p.keterangan || "-"}</td>
        <td>${tanggalStr}</td>
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
      const d = a.waktu?.toDate ? a.waktu.toDate() : (a.waktu? new Date(a.waktu): null);
      if (!d) return false;
      const iso = d.toISOString().split("T")[0];
      if (tStart && iso < tStart) return false;
      if (tEnd && iso > tEnd) return false;
    }
    return true;
  });

  const counts = { Hadir:0, Izin:0, Sakit:0, Alfa:0, Terlambat:0 };
  rows.forEach(r=>{
    const st = (r.status||"hadir").toLowerCase();
    if (st.includes("izin")) counts.Izin++;
    else if (st.includes("sakit")) counts.Sakit++;
    else if (st.includes("alfa")) counts.Alfa++;
    else counts.Hadir++;
    if ((r.keterangan||"").toLowerCase().includes("terlambat")) counts.Terlambat++;
  });

  const labels = ["Hadir","Izin","Sakit","Alfa","Terlambat"];
  const data = labels.map(l=>counts[l]);

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

  let rows = pelanggaranList.filter(p=>{
    if (kelas && p.kelas !== kelas) return false;
    if (nama && p.nama !== nama) return false;
    if (tStart || tEnd) {
      const d = p.tanggal?.toDate ? p.tanggal.toDate() : (p.tanggal? new Date(p.tanggal): null);
      if (!d) return false;
      const iso = d.toISOString().split("T")[0];
      if (tStart && iso < tStart) return false;
      if (tEnd && iso > tEnd) return false;
    }
    return true;
  });

  const agg = {};
  rows.forEach(r=>{
    const k = r.jenis || r.jenis_pelanggaran || "Lainnya";
    agg[k] = (agg[k]||0) + 1;
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
      const ad = a.waktu?.toDate ? a.waktu.toDate() : new Date(a.waktu);
      return ad.toISOString().split("T")[0] === iso;
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
      const pd = p.tanggal?.toDate ? p.tanggal.toDate() : new Date(p.tanggal);
      return pd.toISOString().split("T")[0] === iso;
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
  const a = absensiList.filter(x=>x.nama===nama);
  const p = pelanggaranList.filter(x=>x.nama===nama);
  const c = catatanList.filter(x=>x.nama===nama);

  let html = `<h6>Rekap Kehadiran (${a.length})</h6><ul>`;
  a.slice(0,100).forEach(it=>{
    const waktu = it.waktu?.toDate ? it.waktu.toDate().toLocaleString("id-ID") : (it.waktu? new Date(it.waktu).toLocaleString():'-');
    html += `<li>${waktu} — ${it.status || 'Hadir'} ${it.keterangan ? '- ' + it.keterangan : ''}</li>`;
  });
  html += `</ul><h6 class="mt-3">Pelanggaran (${p.length})</h6><ul>`;
  p.slice(0,100).forEach(it=>{
    const t = it.tanggal?.toDate ? it.tanggal.toDate().toLocaleString("id-ID") : (it.tanggal? new Date(it.tanggal).toLocaleString():'-');
    html += `<li>${t} — ${it.jenis || it.jenis_pelanggaran || '-'} ${it.poin? ' ('+it.poin+' poin)':''} ${it.keterangan? '- '+it.keterangan : ''}</li>`;
  });
  html += `</ul><h6 class="mt-3">Catatan Guru (${c.length})</h6><ul>`;
  c.slice(0,100).forEach(it=>{
    html += `<li><b>${it.guru || 'Guru'}</b>: ${it.catatan || '-'} <small class="text-muted">${it.tanggal || ''}</small></li>`;
  });
  html += `</ul>`;
  detailContent.innerHTML = html;

  // small doughnut
  // DOUGHNUT KECIL (Detail per Siswa)
if (chartDetail) chartDetail.destroy();
chartDetail = new Chart(chartDetailCanvas, {
  type: "doughnut",
  data: {
    labels: ["Hadir","Izin","Sakit","Alfa","Terlambat"],
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
  trsA.forEach(tr=>{
    const cols = Array.from(tr.children).map(td=>td.textContent.trim());
    if (cols.length === 6) rows.push(["Absensi", ...cols]); // prefix supaya tahu jenis
  });
  // pelanggaran
  const trsP = document.querySelectorAll("#bodyPelanggaran tr");
  trsP.forEach(tr=>{
    const cols = Array.from(tr.children).map(td=>td.textContent.trim());
    if (cols.length === 7) rows.push(["Pelanggaran", ...cols]);
  });
  return rows;
}

function exportExcelCurrent() {
  const rows = gatherRowsFromTables();
  if (!rows.length) return alert("Tidak ada data untuk di-export.");
  const header = ["Tipe","No","Nama","Kelas","Col4","Col5","Col6","Col7"];
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap");
  XLSX.writeFile(wb, `Rekap_Wali_${new Date().toISOString().slice(0,10)}.xlsx`);
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
  rows.forEach(r=>{
    doc.text(r.join(" | "), 14, y);
    y += 6;
    if (y > 180) { doc.addPage(); y = 20; }
  });
  doc.save(`Rekap_Wali_${new Date().toISOString().slice(0,10)}.pdf`);
}


/* print friendly */
btnPrint.addEventListener("click", ()=> {
  let html = `<h3>Rekap Wali Kelas</h3><table border="1" style="width:100%; border-collapse: collapse;"><thead><tr><th>Tipe</th><th>No</th><th>Nama</th><th>Kelas</th><th>Col4</th><th>Col5</th><th>Col6</th></tr></thead><tbody>`;
  const rows = gatherRowsFromTables();
  rows.forEach(r=>{
    const cols = r.map(c=>`<td style="padding:6px">${c}</td>`).join("");
    html += `<tr>${cols}</tr>`;
  });
  html += `</tbody></table>`;
  printArea.innerHTML = html;
  window.print();
});


/* realtime subscriptions */
let unsubAbs=null, unsubPel=null, unsubCat=null;

/* load master siswa once (for dropdowns) */
async function loadMasterSiswa(kelasWali="") {
  try {
    const q = query(collection(db,"siswa"));
    const snap = await getDocs(q);
    siswaList = snap.docs.map(d=>({id:d.id, ...d.data()}));
    kelasList = Array.from(new Set(siswaList.map(s=>s.kelas).filter(Boolean)));
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
    const qAbs = query(collection(db,"absensi"), where("kelas","==",kelas));
    unsubAbs = onSnapshot(qAbs, snap=>{
      absensiList = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderTrenAbsensiMingguan();
    }, err=> console.error("absensi onSnapshot:", err));
  } else { absensiList = []; renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderTrenAbsensiMingguan();
 }

  // pelanggaran_siswa
  if (kelas) {
    const qPel = query(collection(db,"pelanggaran_siswa"), where("kelas","==",kelas));
    unsubPel = onSnapshot(qPel, snap=>{
      pelanggaranList = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderTableAbsensi(); renderTablePelanggaran(); renderPelanggaranChart(); renderTrenPelanggaranMingguan();
    }, err=> console.error("pelanggaran onSnapshot:", err));
  } else { pelanggaranList = []; renderTableAbsensi(); renderTablePelanggaran(); renderPelanggaranChart(); renderTrenPelanggaranMingguan();}

  // catatan_kelas
  if (kelas) {
    const qCat = query(collection(db,"catatan_kelas"), where("kelas","==",kelas));
    unsubCat = onSnapshot(qCat, snap=>{
      catatanList = snap.docs.map(d=>({id:d.id, ...d.data()}));
    }, err=> console.error("catatan onSnapshot:", err));
  } else { catatanList = []; }
}

/* INIT: auth & fallback localStorage */
onAuthStateChanged(auth, async (user) => {
  L("onAuthStateChanged =>", user ? "firebase user present":"no firebase user");
  let userData = {};
  try { userData = JSON.parse(localStorage.getItem("userData") || "{}"); } catch(e){ userData = {}; }

  if (!user && (!userData || Object.keys(userData).length === 0)) {
    setStatus("Belum login. Mengarahkan ke halaman login...", "warning");
    setTimeout(()=> window.location.href = "index.html", 800);
    return;
  }

  if (!userData.role) {
    // if role missing, attempt to default to wali_kelas if kelas present
    if (userData.kelasWali) userData.role = "wali_kelas";
  }

  if (!["wali_kelas","guru"].includes((userData.role||"").toLowerCase())) {
    setStatus("Akses ditolak. Hanya wali kelas/guru.", "danger");
    setTimeout(()=> { localStorage.removeItem("userData"); window.location.href="index.html"; }, 1200);
    return;
  }

  const nama = userData.nama || user?.displayName || user?.email || "Wali Kelas";
  const kelasWali = userData.kelasWali || userData.kelas || "";

  namaWaliEl.textContent = nama;
  setStatus(`Menampilkan data untuk kelas: ${kelasWali || "Pilih kelas"}`, "success");

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
filterKelasEl.addEventListener("change", ()=>{
  const k = filterKelasEl.value;
  fillSiswa(k);
  attachRealtime(k);
  renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderPelanggaranChart();renderTrenAbsensiMingguan(); renderTrenPelanggaranMingguan();
}); 
filterSiswaEl.addEventListener("change", ()=> { renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderPelanggaranChart(); });
filterTanggalMulai.addEventListener("change", ()=> { renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderPelanggaranChart(); });
filterTanggalAkhir.addEventListener("change", ()=> { renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderPelanggaranChart(); });
inputCari.addEventListener("input", ()=> { renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderPelanggaranChart(); });
btnRefresh.addEventListener("click", ()=> { renderTableAbsensi(); renderTablePelanggaran(); renderAbsensiChart(); renderPelanggaranChart(); });
btnExportExcel.addEventListener("click", exportExcelCurrent);
btnExportPDF.addEventListener("click", exportPDFCurrent);

/* initial */
L("dashboard_wali_kelas.js loaded");
