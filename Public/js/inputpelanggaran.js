// js/inputpelanggaran.js
// Versi final: fitur lengkap (tanpa notifikasi & dark mode)
// - Cetak PDF SP (per siswa / per kelas)
// - Export Excel (rekap pelanggaran)
// - Grafik tren pelanggaran (Chart.js)
// - Rekap per siswa lengkap, statistik kelas
// - Mobile friendly support hooks
// - Fix: daftar siswa tidak muncul (normalisasi kelas + load awal)

// Firebase v11 imports via CDN (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ---------------- FIREBASE CONFIG ----------------
const firebaseConfig = {
  apiKey: "AIzaSyAXg6GUd0Aw1Ku0DmWKN0VNGgrbluO26i8",
  authDomain: "sistem-sekolah-6a1d5.firebaseapp.com",
  projectId: "sistem-sekolah-6a1d5",
  storageBucket: "sistem-sekolah-6a1d5.firebasestorage.app",
  messagingSenderId: "152901594945",
  appId: "1:152901594945:web:a672dd14fe231a89bebbc0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// DOM refs
const pilihKelas = document.getElementById('pilihKelas');
const namaSiswa = document.getElementById('namaSiswa');
const jenisPelanggaran = document.getElementById('jenisPelanggaran');
const poinInput = document.getElementById('poin');
const tabel = document.getElementById('tabelPelanggaran');
const filterKelas = document.getElementById('filterKelas');
const filterSiswa = document.getElementById('filterSiswa');
const fab = document.getElementById('fab');

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
    // redirect to login
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;
  // load user details from 'users' collection
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
    if (snap.empty) {
      alert('Akun tidak terdaftar. Hubungi admin.');
      auth.signOut();
      return;
    }
    currentUserData = snap.docs[0].data();
    // Tampilkan nama user di header
document.getElementById("namaUser").textContent =
  currentUserData.nama || currentUserData.email || "User";

// Event Logout
document.getElementById("logoutBtn").onclick = () => {
  auth.signOut();
  window.location.href = "index.html";
};
    if (!['guru', 'kepsek', 'piket', 'umum'].includes(currentUserData.role) && !(currentUserData.roles && currentUserData.roles.includes('piket'))) {
      alert('Akses ditolak. Halaman ini hanya untuk pengguna yang diizinkan.');
      window.location.href = 'index.html';
      return;
    }
    init();
  } catch (err) {
    console.error('Error auth role check:', err);
    alert('Terjadi kesalahan autentikasi. Coba lagi.');
    auth.signOut();
  }
});

// ---------------- INIT ----------------
async function init() {
  await loadKelas(); // load kelas dan juga loadSiswa('') di akhir
  await loadJenis();
  await loadRiwayat();
  attachUI();
  // optional realtime:
  // onSnapshot(collection(db, 'pelanggaran'), () => loadRiwayat());
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

  // load siswa awal (semua siswa) supaya dropdown terlihat langsung
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
      // accept multiple possible kelas fields
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

// ---------------- SIMPAN PELANGGARAN ----------------
export async function savePelanggaran(evt) {
  evt.preventDefault();
  try {
    const kelas = pilihKelas.value;
    const siswaId = namaSiswa.value;
    const siswaNama = namaSiswa.selectedOptions[0]?.textContent;
    const jenisOpt = jenisPelanggaran.selectedOptions[0];
    const ket = document.getElementById('keterangan')?.value || '';

    if (!kelas || !siswaId || !jenisOpt) {
      alert('Lengkapi semua data!');
      return;
    }

    const poin = Number(jenisOpt.dataset.poin || 0);
    const kategori = jenisOpt.dataset.kategori || '';

    await addDoc(collection(db, 'pelanggaran'), {
  siswaId,
  namaSiswa: siswaNama,
  kelas,
  jenis: jenisOpt.value,
  kategori,
  poin,
  keterangan: ket,
  createdAt: new Date().toISOString().slice(0, 10)
});


    await updateTotalPoin(siswaId);
    alert('✅ Pelanggaran tersimpan');
    document.getElementById('formPelanggaran').reset();
    namaSiswa.innerHTML = '<option value="">-- Pilih Siswa --</option>';
    await loadRiwayat();
  } catch (err) {
    console.error('Gagal simpan pelanggaran:', err);
    alert('Gagal menyimpan pelanggaran. Periksa console.');
  }
}

document.getElementById('formPelanggaran')?.addEventListener('submit', savePelanggaran);

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
export async function loadRiwayat() {
  try {
    const snap = await getDocs(collection(db, 'pelanggaran'));
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    arr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    tabel.innerHTML = '';
    arr.forEach(p => {
      tabel.innerHTML += `
      <tr class="border-b">
        <td class="p-2">${escapeHtml(p.createdAt || '')}</td>
        <td class="p-2">${escapeHtml(p.namaSiswa || '')}</td>
        <td class="p-2">${escapeHtml(p.kelas || '')}</td>
        <td class="p-2">${escapeHtml(p.jenis || '')}</td>
        <td class="p-2">${escapeHtml(p.kategori || '')}</td>
        <td class="p-2">${escapeHtml(String(p.poin || 0))}</td>
      </tr>`;
    });

    // statistics for chart/export
    computeStatistics(arr);
  } catch (err) {
    console.error('Gagal load riwayat:', err);
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
    if (!rows.length) return alert('Belum ada data pelanggaran');

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pelanggaran');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_pelanggaran_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    console.error('Gagal export Excel:', err);
    alert('Gagal export Excel.');
  }
}

// ---------------- PRINT PDF (SP) ----------------
export async function printSPForSiswa(siswaId) {
  try {
    await loadScript(libs.jspdf);
    await loadScript(libs.jspdf_autotable);
    const { jsPDF } = window.jspdf || window.jspPDF || {};
    if (!jsPDF) return alert('jsPDF gagal dimuat');

    // fetch siswa data directly
    const siswaSnap = await getDocs(collection(db, 'siswa'));
    const found = siswaSnap.docs.find(d => d.id === siswaId);
    if (!found) return alert('Data siswa tidak ditemukan');
    const siswaData = found.data();

    const q = query(collection(db, 'pelanggaran'), where('siswaId', '==', siswaId));
    const pelSnap = await getDocs(q);
    const rows = pelSnap.docs.map(d => d.data());

    const docPDF = new jsPDF({ unit: 'pt', format: 'a4' });
    docPDF.setFontSize(14);
    docPDF.text('Surat Peringatan (Rekap)', 40, 50);
    docPDF.setFontSize(11);
    docPDF.text(`Nama: ${siswaData.nama || '-'}    Kelas: ${siswaData.kelas || '-'}    NIS: ${siswaData.nis || '-'}`, 40, 70);

    const tableCols = ['Tanggal','Jenis','Kategori','Poin','Keterangan'];
    const tableRows = rows.map(r => [r.createdAt||r.tanggal||'', r.jenis||'', r.kategori||'', String(r.poin||0), r.keterangan||'']);

    docPDF.autoTable({ head:[tableCols], body:tableRows, startY:90, styles:{fontSize:10}});

    const total = rows.reduce((s,n) => s + (Number(n.poin || 0)), 0);
    docPDF.text(`Total Poin: ${total}`, 40, docPDF.lastAutoTable.finalY + 20);
    docPDF.save(`SP_${siswaData.nama || siswaId}.pdf`);
  } catch (err) {
    console.error('Gagal cetak SP siswa:', err);
    alert('Gagal membuat PDF.');
  }
}

// ---------------- PRINT PDF PER KELAS ----------------
export async function printSPForKelas(kelas) {
  try {
    await loadScript(libs.jspdf);
    await loadScript(libs.jspdf_autotable);
    const { jsPDF } = window.jspdf || window.jspPDF || {};
    if (!jsPDF) return alert('jsPDF gagal dimuat');

    const pelSnap = await getDocs(collection(db, 'pelanggaran'));
    const recs = pelSnap.docs.map(d => d.data()).filter(r => r.kelas === kelas);
    if (!recs.length) return alert('Tidak ada data untuk kelas ini');

    const perS = {};
    recs.forEach(r => {
      perS[r.siswaId] = perS[r.siswaId] || { nama: r.namaSiswa, rows: [], total: 0 };
      perS[r.siswaId].rows.push(r);
      perS[r.siswaId].total += Number(r.poin || 0);
    });

    const docPDF = new jsPDF({ unit: 'pt', format: 'a4' });
    docPDF.setFontSize(14);
    docPDF.text(`Rekap Pelanggaran Kelas ${kelas}`, 40, 50);
    let y = 80;
    for (const sid in perS) {
      const s = perS[sid];
      docPDF.setFontSize(11);
      docPDF.text(`${s.nama} - Total: ${s.total}`, 40, y);
      y += 14;
      const tableRows = s.rows.map(r => [r.createdAt||r.tanggal||'', r.jenis||'', r.kategori||'', String(r.poin||0), r.keterangan||'']);
      docPDF.autoTable({ startY: y, head:[['Tgl','Jenis','Kat','Poin','Ket']], body:tableRows, styles:{fontSize:9}, theme:'grid' });
      y = docPDF.lastAutoTable.finalY + 12;
      if (y > 720) { docPDF.addPage(); y = 40; }
    }
    docPDF.save(`rekap_kelas_${kelas}_${new Date().toISOString().slice(0,10)}.pdf`);
  } catch (err) {
    console.error('Gagal cetak SP kelas:', err);
    alert('Gagal membuat PDF kelas.');
  }
}

// ---------------- CHART (TREN PELANGGARAN) ----------------
let chartInstance = null;
export async function renderChart(containerId = 'chartContainer') {
  try {
    await loadScript(libs.chartjs);
    /* global Chart */
    const snap = await getDocs(collection(db, 'pelanggaran'));
    const rows = snap.docs.map(d => d.data());
    const byDate = {};
    rows.forEach(r => {
      const d = r.createdAt || r.tanggal || (new Date()).toISOString().slice(0,10);
      byDate[d] = (byDate[d] || 0) + Number(r.poin || 0);
    });
    const labels = Object.keys(byDate).sort();
    const data = labels.map(l => byDate[l]);

    let container = document.getElementById(containerId);
    if (!container) {
      const sec = document.createElement('section');
      sec.className = 'bg-white shadow rounded p-4 my-4';
      sec.innerHTML = `<h3 class="font-bold mb-2">📈 Tren Pelanggaran</h3><canvas id="${containerId}_canvas" style="width:100%;height:320px"></canvas>`;
      document.querySelector('main').appendChild(sec);
      container = document.getElementById(containerId);
    }
    const ctx = document.getElementById(`${containerId}_canvas`).getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Poin per Tanggal',
          data,
          tension: 0.3,
          fill: false
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  } catch (err) {
    console.error('Gagal render chart:', err);
    alert('Gagal menampilkan grafik.');
  }
}

// ---------------- EXPORT REKAP PER SISWA (PDF & EXCEL) ----------------
export async function exportRekapPerSiswa(siswaId) {
  try {
    await loadScript(libs.xlsx);
    const q = query(collection(db, 'pelanggaran'), where('siswaId', '==', siswaId));
    const snap = await getDocs(q);
    const rows = snap.docs.map(d => d.data());
    if (!rows.length) return alert('Tidak ada data pelanggaran untuk siswa ini');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `rekap_${siswaId}.xlsx`; document.body.appendChild(a); a.click(); a.remove();
  } catch (err) {
    console.error('Gagal export rekap siswa:', err);
    alert('Gagal export rekap siswa.');
  }
}

// ---------------- UI ATTACH ----------------
function attachUI() {
  // when kelas selected in main form, load siswa for that kelas
  pilihKelas?.addEventListener('change', async (e) => {
    const kelas = e.target.value;
    await loadSiswa(kelas);
  });

  // filterKelas (top filter) behavior: fill siswa dropdown and filter riwayat table
  filterKelas?.addEventListener('change', async (e) => {
    const kelas = e.target.value;
    await loadSiswa(kelas);
    if (kelas) {
      const snap = await getDocs(collection(db, 'pelanggaran'));
      const rows = snap.docs.map(d => d.data()).filter(r => r.kelas === kelas);
      tabel.innerHTML = '';
      rows.forEach(p => {
        tabel.innerHTML += `<tr class="border-b"><td class="p-2">${escapeHtml(p.createdAt||p.tanggal||'')}</td><td class="p-2">${escapeHtml(p.namaSiswa)}</td><td class="p-2">${escapeHtml(p.kelas)}</td><td class="p-2">${escapeHtml(p.jenis)}</td><td class="p-2">${escapeHtml(p.kategori)}</td><td class="p-2">${escapeHtml(String(p.poin||0))}</td></tr>`;
      });
    } else {
      loadRiwayat();
    }
  });

  // filterSiswa behavior: filter riwayat by nama siswa
  filterSiswa?.addEventListener('change', async (e) => {
    const nama = e.target.value;
    if (!nama) { loadRiwayat(); return; }
    const snap = await getDocs(collection(db, 'pelanggaran'));
    const rows = snap.docs.map(d => d.data()).filter(r => r.namaSiswa === nama);
    tabel.innerHTML = '';
    rows.forEach(p => {
      tabel.innerHTML += `<tr class="border-b"><td class="p-2">${escapeHtml(p.createdAt||p.tanggal||'')}</td><td class="p-2">${escapeHtml(p.namaSiswa)}</td><td class="p-2">${escapeHtml(p.kelas)}</td><td class="p-2">${escapeHtml(p.jenis)}</td><td class="p-2">${escapeHtml(p.kategori)}</td><td class="p-2">${escapeHtml(String(p.poin||0))}</td></tr>`;
    });
  });

  // floating action: scroll to top
  fab?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // optional: render chart floating button
  const chartBtn = document.createElement('button');
  chartBtn.className = 'bg-blue-600 text-white px-3 py-2 rounded fixed left-4 bottom-4 z-50';
  chartBtn.textContent = 'Grafik';
  chartBtn.addEventListener('click', () => renderChart());
  document.body.appendChild(chartBtn);

  // add export buttons into header area (if exists)
  const headerRight = document.querySelector('header div');
  if (headerRight) {
    const container = document.createElement('div');
    container.className = 'flex items-center gap-2';
    const btnExcel = document.createElement('button');
    btnExcel.className = 'bg-green-600 text-white px-3 py-1 rounded text-sm';
    btnExcel.textContent = 'Export Excel';
    btnExcel.addEventListener('click', exportExcel);

    const btnPdfAll = document.createElement('button');
    btnPdfAll.className = 'bg-indigo-600 text-white px-3 py-1 rounded text-sm';
    btnPdfAll.textContent = 'Cetak SP Kelas';
    btnPdfAll.addEventListener('click', async () => {
      const kelas = filterKelas.value || pilihKelas.value;
      if (!kelas) return alert('Pilih kelas untuk cetak SP per kelas');
      await printSPForKelas(kelas);
    });

    container.appendChild(btnExcel);
    container.appendChild(btnPdfAll);
    headerRight.appendChild(container);
  }
}

// ---------------- HELPERS ----------------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ---------------- EXPORT DEFAULTS ----------------
export default {
  loadKelas,
  loadSiswa,
  loadJenis,
  loadRiwayat,
  savePelanggaran,
  exportExcel,
  printSPForSiswa,
  printSPForKelas,
  renderChart,
  exportRekapPerSiswa
};
