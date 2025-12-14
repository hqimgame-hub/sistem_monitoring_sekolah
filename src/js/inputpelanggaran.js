// js/inputpelanggaran.js
// Refactored to use Shared Components & Local Firebase Init

import {
  db, auth, collection, getDocs, query, where,
  addDoc, doc, updateDoc, deleteDoc, onSnapshot, orderBy, limit, serverTimestamp, getDoc
} from "./firebase_init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { renderNavbar } from "./components/Navbar.js";
import { UI } from "./utils/UI.js";

// DOM refs
const pilihKelas = document.getElementById('pilihKelas');
const namaSiswa = document.getElementById('namaSiswa');
const jenisPelanggaran = document.getElementById('jenisPelanggaran');
const poinInput = document.getElementById('poin');
const tabel = document.getElementById('tabelPelanggaran');
const filterKelas = document.getElementById('filterKelas');
const filterSiswa = document.getElementById('filterSiswa');
const fab = document.getElementById('fab');
const loadingOverlay = document.getElementById('loadingOverlay');
const formPelanggaran = document.getElementById('formPelanggaran');

// Tabs & Pagination
const btnTabInput = document.getElementById('btnTabInput');
const btnTabData = document.getElementById('btnTabData');
const tabInput = document.getElementById('tabInput');
const tabData = document.getElementById('tabData');

const pageStartEl = document.getElementById('pageStart');
const pageEndEl = document.getElementById('pageEnd');
const totalRecordsEl = document.getElementById('totalRecords');
const btnPrev = document.getElementById('btnPrevDoc');
const btnNext = document.getElementById('btnNextDoc');

let itemsPerPage = 10;
let currentPage = 1;
let allRecords = []; // Store all fetched records for client-side pagination

// Utility: dynamic script loader
function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Gagal load ' + url));
    document.head.appendChild(s);
  });
}

const libs = {
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  jspdf_autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  chartjs: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
};

// ---------------- AUTH + ROLE CHECK ----------------
let currentUser = null;
let currentUserData = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;


  if (loadingOverlay) loadingOverlay.classList.remove('hidden');
  UI.showLoading("Memeriksa akses...");

  try {
    const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
    if (snap.empty) {
      UI.showToast('Akun tidak terdaftar. Hubungi admin.', 'error');
      await signOut(auth);
      return;
    }
    currentUserData = snap.docs[0].data();

    if (!['guru', 'kepsek', 'piket', 'umum', 'admin'].includes(currentUserData.role) && !(currentUserData.roles && currentUserData.roles.includes('piket'))) {
      UI.showToast('Akses ditolak. Halaman ini hanya untuk pengguna yang diizinkan.', 'error');
      window.location.href = 'index.html';
      return;
    }

    init(user);

  } catch (err) {
    console.error('Error auth role check:', err);
    UI.showToast('Terjadi kesalahan autentikasi. Coba lagi.', 'error');
    await signOut(auth);
  }
});

// ---------------- INIT ----------------
async function init(user) {
  // Sidebar removed

  renderNavbar({
    title: 'Input Pelanggaran',
    userEmail: user.email,
    onLogout: async () => {
      await signOut(auth);
      window.location.href = "index.html";
    }
  });

  // Reveal Content & Load Data
  const mainContent = document.getElementById('main-content');
  if (mainContent) mainContent.classList.remove('opacity-0', 'transform', 'translate-y-4');
  if (loadingOverlay) loadingOverlay.classList.add('hidden');
  UI.hideLoading();

  await loadKelas();
  await loadJenis();
  await loadRiwayat();
  await loadRiwayat();
  attachUI();
  setupTabs();
  setupPagination();
}

// ---------------- LOAD KELAS ----------------
export async function loadKelas() {
  if (!filterKelas || !pilihKelas) return;
  filterKelas.innerHTML = '<option value="">Semua Kelas</option>';
  pilihKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
  try {
    const snap = await getDocs(collection(db, 'kelas'));
    snap.forEach(d => {
      const name = (d.data().namaKelas || d.data().name || d.id || '').toString().trim();
      if (!name) return;
      filterKelas.innerHTML += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
      pilihKelas.innerHTML += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    });
  } catch (err) {
    console.error('Gagal load kelas:', err);
  }

  // Also populate initial students (all)
  await loadSiswa('');
}

// ---------------- LOAD SISWA BY KELAS ----------------
export async function loadSiswa(kelas) {
  if (!namaSiswa || !filterSiswa) return;
  namaSiswa.innerHTML = '<option value="">-- Pilih Siswa --</option>';
  filterSiswa.innerHTML = '<option value="">Semua Siswa</option>';

  const kelasNorm = (kelas || '').toString().trim().toUpperCase();

  try {
    const snap = await getDocs(collection(db, 'siswa'));
    snap.forEach(d => {
      const s = d.data();
      const rawKelas = (s.kelas || s.Kelas || s.kls || '').toString();
      const siswaKelasNorm = rawKelas.trim().toUpperCase();

      if (!kelasNorm || kelasNorm === siswaKelasNorm) {
        const nama = s.nama || s.Nama || d.id;
        namaSiswa.innerHTML += `<option value="${escapeHtml(d.id)}">${escapeHtml(nama)}</option>`;
        filterSiswa.innerHTML += `<option value="${escapeHtml(nama)}" data-id="${escapeHtml(d.id)}">${escapeHtml(nama)}</option>`;
      }
    });
  } catch (err) {
    console.error('Gagal load siswa:', err);
  }
}

// ---------------- LOAD JENIS PELANGGARAN ----------------
export async function loadJenis() {
  if (!jenisPelanggaran) return;
  jenisPelanggaran.innerHTML = '<option value="">-- Pilih Jenis --</option>';
  try {
    const snap = await getDocs(collection(db, 'jenis_pelanggaran'));
    snap.forEach(d => {
      const j = d.data();
      const opt = document.createElement('option');
      opt.value = j.nama || d.id;
      opt.textContent = `${j.nama}${j.kategori ? ' (' + j.kategori + ')' : ''}`;
      if (j.poin !== undefined) opt.dataset.poin = j.poin;
      if (j.kategori !== undefined) opt.dataset.kategori = j.kategori;
      jenisPelanggaran.appendChild(opt);
    });
  } catch (err) {
    console.error('Gagal load jenis pelanggaran:', err);
  }
}

jenisPelanggaran?.addEventListener('change', (e) => {
  const o = e.target.selectedOptions[0];
  poinInput.value = o ? o.dataset.poin || '' : '';
});

// ---------------- SIMPAN / UPDATE PELANGGARAN ----------------
export async function savePelanggaran(evt) {
  evt.preventDefault();
  try {
    const kelas = pilihKelas.value;
    const siswaId = namaSiswa.value;
    const siswaNama = namaSiswa.selectedOptions[0]?.textContent;
    const jenisOpt = jenisPelanggaran.selectedOptions[0];
    const ket = document.getElementById('keterangan')?.value || '';

    if (!kelas || !siswaId || !jenisOpt) {
      UI.showToast('Lengkapi semua data!', 'warning');
      return;
    }

    const poin = Number(jenisOpt.dataset.poin || 0);
    const kategori = jenisOpt.dataset.kategori || '';

    const payload = {
      siswaId,
      namaSiswa: siswaNama,
      kelas,
      jenis: jenisOpt.value,
      kategori,
      poin,
      keterangan: ket,
    };

    UI.showLoading("Menyimpan data...");
    if (!isEditingId) {
      // CREATE
      payload.createdAt = new Date().toISOString().slice(0, 10);
      payload.timestamp = serverTimestamp();
      await addDoc(collection(db, 'pelanggaran'), payload);
      UI.showToast('✅ Pelanggaran tersimpan', 'success');
    } else {
      // UPDATE
      await updateDoc(doc(db, 'pelanggaran', isEditingId), payload);
      UI.showToast('✅ Pelanggaran diperbarui', 'success');
      isEditingId = null;
      const btn = document.querySelector('button[type="submit"]');
      if (btn) {
        btn.innerHTML = '<i class="bi bi-save"></i> Simpan Data';
        btn.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
        btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
      }
    }

    await updateTotalPoin(siswaId);
    formPelanggaran.reset();
    namaSiswa.innerHTML = '<option value="">-- Pilih Siswa --</option>';
    await loadRiwayat();
  } catch (err) {
    console.error('Gagal simpan pelanggaran:', err);
    UI.showToast('Gagal menyimpan pelanggaran.', 'error');
  } finally {
    UI.hideLoading();
  }
}

document.getElementById('formPelanggaran')?.addEventListener('submit', savePelanggaran);

// ---------------- DELETE ----------------
window.deletePelanggaran = async (id, siswaId, poin) => {
  if (!await UI.confirm("Yakin hapus data ini?")) return;
  UI.showLoading("Menghapus data...");
  try {
    await deleteDoc(doc(db, 'pelanggaran', id));
    await updateTotalPoin(siswaId); // Recalculate
    await loadRiwayat();
    UI.showToast("Data berhasil dihapus", "success");
  } catch (e) {
    console.error(e);
    UI.showToast("Gagal hapus data", "error");
  } finally {
    UI.hideLoading();
  }
}

// ---------------- EDIT ----------------
window.editPelanggaran = async (id) => {
  try {
    UI.showLoading("Memuat data edit...");
    const snap = await getDoc(doc(db, 'pelanggaran', id));
    if (!snap.exists()) {
      UI.hideLoading();
      return UI.showToast("Data tidak ditemukan", "error");
    }
    const data = snap.data();

    // Populate Form
    pilihKelas.value = data.kelas;
    await loadSiswa(data.kelas); // reload siswa list for this kelas
    namaSiswa.value = data.siswaId;

    // Match jenis
    Array.from(jenisPelanggaran.options).forEach(opt => {
      if (opt.value === data.jenis) opt.selected = true;
    });

    document.getElementById('poin').value = data.poin;
    document.getElementById('keterangan').value = data.keterangan || '';

    isEditingId = id;
    const btn = document.querySelector('button[type="submit"]');
    if (btn) {
      btn.innerHTML = '<i class="bi bi-pencil-square"></i> Update Data';
      btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
      btn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (e) {
    console.error(e);
    UI.showToast("Gagal memuat data edit", "error");
  } finally {
    UI.hideLoading();
  }
}

// ---------------- UPDATE TOTAL POIN ----------------
export async function updateTotalPoin(siswaId) {
  try {
    const q = query(collection(db, 'pelanggaran'), where('siswaId', '==', siswaId));
    const snap = await getDocs(q);
    let total = 0;
    snap.forEach(d => total += Number(d.data().poin || 0));

    const status = total >= 150 ? 'SP3' : total >= 100 ? 'SP2' : total >= 50 ? 'SP1' : 'Aman';
    await updateDoc(doc(db, 'siswa', siswaId), { totalPoin: total, status });
  } catch (err) {
    console.error('Gagal update total poin:', err);
  }
}

// ---------------- LOAD RIWAYAT & STATS ----------------
// ---------------- LOAD RIWAYAT & STATS ----------------
export async function loadRiwayat() {
  try {
    let snap;
    // Fetch MORE data for client-side pagination (e.g. 500 or 1000)
    // Adjust limit as needed
    const q = query(collection(db, 'pelanggaran'), orderBy('createdAt', 'desc'), limit(500));
    snap = await getDocs(q);

    allRecords = [];
    snap.forEach(d => allRecords.push({ id: d.id, ...d.data() }));

    // Sort again just in case (descending date)
    allRecords.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    renderTable();
    computeStatistics(allRecords);

  } catch (err) {
    console.warn("⚠️ Query failed, trying fallback:", err.message);
    try {
      const qFallback = query(collection(db, 'pelanggaran'), limit(500));
      const snap = await getDocs(qFallback);
      allRecords = [];
      snap.forEach(d => allRecords.push({ id: d.id, ...d.data() }));
      allRecords.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); // Sort JS side
      renderTable();
      computeStatistics(allRecords);
    } catch (e2) {
      console.error('Gagal load riwayat:', e2);
      UI.showToast('Gagal memuat data pelanggaran', 'error');
    }
  }
}

// ---------------- RENDER TABLE (PAGINATION) ----------------
function renderTable() {
  if (!tabel) return;
  tabel.innerHTML = '';

  // Filter first if needed (client-side filter)
  let filtered = allRecords;
  const k = filterKelas?.value;
  const s = filterSiswa?.value; // Using value/name stored in option

  if (k) filtered = filtered.filter(r => r.kelas === k);
  // Note: filterSiswa stores name in value, but let's check dataset logic if needed
  // For simplicity, if filterSiswa has value (Name), filter by Name
  if (s) filtered = filtered.filter(r => r.namaSiswa === s);

  const total = filtered.length;
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginated = filtered.slice(start, end);

  // Update Info
  if (pageStartEl) pageStartEl.textContent = total === 0 ? 0 : start + 1;
  if (pageEndEl) pageEndEl.textContent = Math.min(end, total);
  if (totalRecordsEl) totalRecordsEl.textContent = total;

  if (total === 0) {
    tabel.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-400">Belum ada data pelanggaran</td></tr>';
    return;
  }

  paginated.forEach(p => {
    tabel.innerHTML += `
      <tr class="bg-white hover:bg-gray-50 transition-colors">
        <td class="px-4 py-3 text-center">
            <input type="checkbox" class="select-row rounded border-gray-300 text-blue-600 focus:ring-blue-500" value="${p.id}" data-siswa="${escapeHtml(p.siswaId)}" onchange="toggleBulkDeleteBtn()">
        </td>
        <td class="px-4 py-3 font-mono text-xs text-gray-500">${escapeHtml(p.createdAt || '')}</td>
        <td class="px-4 py-3 font-semibold text-gray-800">${escapeHtml(p.namaSiswa || '')}</td>
        <td class="px-4 py-3 text-gray-600">${escapeHtml(p.kelas || '')}</td>
        <td class="px-4 py-3">
            <span class="bg-red-50 text-red-700 px-2 py-1 rounded text-xs border border-red-100">${escapeHtml(p.jenis || '')}</span>
        </td>
        <td class="px-4 py-3 text-center font-bold text-red-600">+${escapeHtml(String(p.poin || 0))}</td>
        <td class="px-4 py-3 text-center flex gap-2 justify-center">
           <button onclick="editPelanggaran('${p.id}')" class="text-blue-600 hover:text-blue-800" title="Edit"><i class="bi bi-pencil-square"></i></button>
           <button onclick="deletePelanggaran('${p.id}', '${p.siswaId}', ${p.poin})" class="text-red-600 hover:text-red-800" title="Hapus"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  });
}

function setupTabs() {
  if (!btnTabInput || !btnTabData) return;

  btnTabInput.addEventListener('click', () => {
    // Show Input
    tabInput.classList.remove('hidden');
    tabData.classList.add('hidden');

    // Active Styles
    btnTabInput.classList.add('text-blue-600', 'border-blue-600');
    btnTabInput.classList.remove('text-gray-500', 'border-transparent');

    btnTabData.classList.remove('text-blue-600', 'border-blue-600');
    btnTabData.classList.add('text-gray-500', 'border-transparent');
  });

  btnTabData.addEventListener('click', () => {
    // Show Data
    tabData.classList.remove('hidden');
    tabInput.classList.add('hidden');

    // Active Styles
    btnTabData.classList.add('text-blue-600', 'border-blue-600');
    btnTabData.classList.remove('text-gray-500', 'border-transparent');

    btnTabInput.classList.remove('text-blue-600', 'border-blue-600');
    btnTabInput.classList.add('text-gray-500', 'border-transparent');
  });
}

function setupPagination() {
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const k = filterKelas?.value;
      const s = filterSiswa?.value;
      let filtered = allRecords;
      if (k) filtered = filtered.filter(r => r.kelas === k);
      if (s) filtered = filtered.filter(r => r.namaSiswa === s);

      if ((currentPage * itemsPerPage) < filtered.length) {
        currentPage++;
        renderTable();
      }
    });
  }
}

// ---------------- COMPUTE STATS ----------------
let latestStats = { perKelas: {}, perSiswa: {}, jenisCount: {} };
export function computeStatistics(records) {
  const perKelas = {};
  const perSiswa = {};
  const jenisCount = {};
  records.forEach(r => {
    perKelas[r.kelas] = perKelas[r.kelas] || { totalPoin: 0, count: 0 };
    perKelas[r.kelas].totalPoin += Number(r.poin || 0);
    perKelas[r.kelas].count += 1;

    perSiswa[r.siswaId] = perSiswa[r.siswaId] || { nama: r.namaSiswa, totalPoin: 0, count: 0 };
    perSiswa[r.siswaId].totalPoin += Number(r.poin || 0);
    perSiswa[r.siswaId].count += 1;

    jenisCount[r.jenis] = (jenisCount[r.jenis] || 0) + 1;
  });
  latestStats = { perKelas, perSiswa, jenisCount };
}

// ---------------- EXPORT EXCEL ----------------
export async function exportExcel() {
  try {
    await loadScript(libs.xlsx);
    /* global XLSX */
    const snap = await getDocs(collection(db, 'pelanggaran'));
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!rows.length) return UI.showToast('Belum ada data pelanggaran', 'info');

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pelanggaran');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_pelanggaran_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    console.error('Gagal export Excel:', err);
    UI.showToast('Gagal export Excel.', 'error');
  }
}

// ---------------- PRINT PDF (SP) & CLASS ----------------
// ... (Keeping print helper functions mostly same but cleaner if needed)
export async function printSPForKelas(kelas) {
  // ... same logic as before, just updating alert/logs
  try {
    await loadScript(libs.jspdf);
    await loadScript(libs.jspdf_autotable);
    const { jsPDF } = window.jspdf || window.jspPDF || {};
    const pelSnap = await getDocs(collection(db, 'pelanggaran'));
    const recs = pelSnap.docs.map(d => d.data()).filter(r => r.kelas === kelas);
    if (!recs.length) return UI.showToast('Tidak ada data untuk kelas ini', 'info');

    // Group by Student
    const perS = {};
    recs.forEach(r => {
      perS[r.siswaId] = perS[r.siswaId] || { nama: r.namaSiswa, rows: [], total: 0 };
      perS[r.siswaId].rows.push(r);
      perS[r.siswaId].total += Number(r.poin || 0);
    });

    const docPDF = new jsPDF({ unit: 'pt', format: 'a4' });
    docPDF.text(`Rekap Pelanggaran Kelas ${kelas}`, 40, 50);

    let y = 80;
    for (const sid in perS) {
      const s = perS[sid];
      docPDF.setFontSize(11);
      docPDF.text(`${s.nama} - Total Poin: ${s.total}`, 40, y);
      y += 20;
      const tableRows = s.rows.map(r => [r.createdAt || '', r.jenis || '', String(r.poin || 0)]);
      docPDF.autoTable({
        startY: y,
        head: [['Tgl', 'Jenis', 'Poin']],
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 9 }
      });
      y = docPDF.lastAutoTable.finalY + 20;
      if (y > 750) { docPDF.addPage(); y = 50; }
    }
    docPDF.save(`rekap_kelas_${kelas}.pdf`);
  } catch (e) {
    console.error(e);
    alert('Gagal cetak PDF.');
  }
}


// ---------------- CHART ----------------
let chartInstance = null;
export async function renderChart(containerId = 'chartContainerTarget') {
  // Locate target
  const target = document.getElementById(containerId);
  if (!target) return;

  target.innerHTML = `
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
         <h3 class="font-bold text-gray-800 mb-4">📈 Tren Pelanggaran</h3>
         <div class="h-64 relative">
            <canvas id="${containerId}_canvas"></canvas>
         </div>
      </div>
    `;

  try {
    await loadScript(libs.chartjs);
    /* global Chart */
    const snap = await getDocs(collection(db, 'pelanggaran'));
    const rows = snap.docs.map(d => d.data());
    const byDate = {};
    rows.forEach(r => {
      const d = r.createdAt || (new Date()).toISOString().slice(0, 10);
      byDate[d] = (byDate[d] || 0) + Number(r.poin || 0);
    });
    const labels = Object.keys(byDate).sort();
    const data = labels.map(l => byDate[l]);

    const ctx = document.getElementById(`${containerId}_canvas`).getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Poin',
          data,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

  } catch (e) { console.error(e); }
}


// ---------------- UI ATTACH ----------------
function attachUI() {
  pilihKelas?.addEventListener('change', async (e) => loadSiswa(e.target.value));
  filterKelas?.addEventListener('change', async (e) => {
    const k = e.target.value;
    await loadSiswa(k);
    // Filter table logic here or refetch
    // Filter logic update: just reset page and render
    currentPage = 1;
    renderTable();
  });


  // Setup Export Buttons in the unified toolbar
  const exportContainer = document.getElementById('exportButtons');
  if (exportContainer) {
    const btnExcel = document.createElement('button');
    btnExcel.className = 'bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm flex items-center gap-1';
    btnExcel.innerHTML = '<i class="bi bi-file-earmark-excel"></i> Excel';
    btnExcel.onclick = exportExcel;

    const btnPrint = document.createElement('button');
    btnPrint.className = 'bg-gray-700 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm flex items-center gap-1';
    btnPrint.innerHTML = '<i class="bi bi-printer"></i> Cetak SP';
    btnPrint.onclick = async () => {
      const k = filterKelas.value || pilihKelas.value;
      if (!k) return UI.showToast('Pilih kelas dulu!', 'warning');
      printSPForKelas(k);
    };

    const btnChart = document.createElement('button');
    btnChart.className = 'bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm flex items-center gap-1';
    btnChart.innerHTML = '<i class="bi bi-graph-up"></i> Grafik';
    btnChart.onclick = () => renderChart();

    // Btn Bulk Delete (Hidden by default)
    const btnBulkDelete = document.createElement('button');
    btnBulkDelete.id = 'btnBulkDelete';
    btnBulkDelete.className = 'bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm flex items-center gap-1 hidden';
    btnBulkDelete.innerHTML = '<i class="bi bi-trash"></i> Hapus Terpilih';
    btnBulkDelete.onclick = deleteSelected;

    exportContainer.appendChild(btnExcel);
    exportContainer.appendChild(btnPrint);
    exportContainer.appendChild(btnChart);
    exportContainer.appendChild(btnBulkDelete);
  }

  // Select All Listener
  const selectAll = document.getElementById('selectAll');
  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('.select-row');
      checkboxes.forEach(cb => cb.checked = e.target.checked);
      toggleBulkDeleteBtn();
    });
  }

  fab?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  if (fab) fab.classList.remove('hidden');
}

function toggleBulkDeleteBtn() {
  const count = document.querySelectorAll('.select-row:checked').length;
  const btn = document.getElementById('btnBulkDelete');
  if (btn) {
    if (count > 0) {
      btn.classList.remove('hidden');
      btn.innerHTML = `<i class="bi bi-trash"></i> Hapus (${count})`;
    } else {
      btn.classList.add('hidden');
    }
  }
}

// ---------------- BULK DELETE ----------------
async function deleteSelected() {
  const checkboxes = document.querySelectorAll('.select-row:checked');
  if (checkboxes.length === 0) return;

  if (!await UI.confirm(`Yakin hapus ${checkboxes.length} data pelanggaran?`)) return;

  UI.showLoading("Menghapus data masal...");
  try {
    const siswaIdsToUpdate = new Set();
    const deletePromises = [];

    checkboxes.forEach(cb => {
      const id = cb.value;
      const siswaId = cb.dataset.siswa;
      if (siswaId) siswaIdsToUpdate.add(siswaId);
      deletePromises.push(deleteDoc(doc(db, 'pelanggaran', id)));
    });

    await Promise.all(deletePromises);

    // Recalculate stats for affected students
    for (const sid of siswaIdsToUpdate) {
      await updateTotalPoin(sid);
    }

    UI.showToast(`✅ ${checkboxes.length} data telah dihapus.`, 'success');
    if (document.getElementById('selectAll')) document.getElementById('selectAll').checked = false;
    await loadRiwayat(); // Reload
    toggleBulkDeleteBtn(); // Hide button

  } catch (e) {
    console.error('Bulk delete error:', e);
    UI.showToast('Gagal menghapus beberapa data.', 'error');
  } finally {
    UI.hideLoading();
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export default { loadKelas };
