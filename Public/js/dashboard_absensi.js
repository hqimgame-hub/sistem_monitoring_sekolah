import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// 🔧 Ganti dengan konfigurasi Firebase milikmu
const firebaseConfig = {
  apiKey: "ISI_API_KEY_MU_DI_SINI",
  authDomain: "sistem-sekolah-6a1d5.firebaseapp.com",
  projectId: "sistem-sekolah-6a1d5",
  storageBucket: "sistem-sekolah-6a1d5.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const isiTabel = document.getElementById("isiTabel");
const filterTanggal = document.getElementById("filterTanggal");
const filterKelas = document.getElementById("filterKelas");
const inputCari = document.getElementById("inputCari");

let semuaData = [];
let dataTampil = [];
let chart, chartDetail;

// 🕒 Ambil data realtime dari Firestore
const q = query(collection(db, "absensi"), orderBy("waktu", "desc"));
onSnapshot(q, (snapshot) => {
  semuaData = [];
  snapshot.forEach(doc => semuaData.push({ id: doc.id, ...doc.data() }));
  renderTabel();
});

// 🔄 Event listener filter & pencarian
[filterTanggal, filterKelas, inputCari].forEach(el => el.addEventListener("input", renderTabel));

// 🧾 Render tabel sesuai filter dan pencarian
function renderTabel() {
  let data = semuaData;
  const tanggal = filterTanggal.value;
  const kelas = filterKelas.value;
  const keyword = inputCari.value.toLowerCase();

  if (tanggal) {
  data = data.filter(d => {
    if (!d.waktu?.toDate) return false;
    const localDate = d.waktu.toDate();
    const tgl = localDate.getFullYear() + "-" +
      String(localDate.getMonth() + 1).padStart(2, "0") + "-" +
      String(localDate.getDate()).padStart(2, "0");
    return tgl === tanggal;
  });
}

  if (kelas) data = data.filter(d => d.kelas === kelas);
  if (keyword) data = data.filter(d => d.nama?.toLowerCase().includes(keyword));

  dataTampil = data;
  isiTabel.innerHTML = "";

  if (data.length === 0) {
    isiTabel.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-400">❌ Tidak ada data ditemukan</td></tr>`;
    document.getElementById("rekapSiswa").innerHTML = "";
    updateStatistik([]); 
    updateGrafik([]);
    return;
  }

  data.forEach((d, i) => {
    const waktu = d.waktu?.toDate ? d.waktu.toDate().toLocaleString("id-ID") : "-";
    const warnaStatus =
      (d.status || "").toLowerCase() === "izin" ? "text-yellow-600" :
      (d.status || "").toLowerCase() === "sakit" ? "text-blue-600" :
      (d.status || "").toLowerCase() === "alfa" ? "text-red-600" :
      "text-green-600";
    const warnaKet =
      (d.keterangan || "").toLowerCase() === "terlambat"
        ? "text-red-600 font-semibold"
        : "text-green-600";

    const row = `
      <tr class="hover:bg-green-50 cursor-pointer" data-nama="${d.nama}">
        <td class="py-2 px-3">${i + 1}</td>
        <td class="py-2 px-3 font-semibold text-gray-700">${d.nama || "-"}</td>
        <td class="py-2 px-3">${d.kelas || "-"}</td>
        <td class="py-2 px-3 ${warnaStatus} font-semibold">${d.status || "Hadir"}</td>
        <td class="py-2 px-3 ${warnaKet}">${d.keterangan || "-"}</td>
        <td class="py-2 px-3 text-gray-500">${waktu}</td>
      </tr>`;
    isiTabel.insertAdjacentHTML("beforeend", row);
  });

  // Klik nama → detail modal
  document.querySelectorAll("#isiTabel tr").forEach(row =>
    row.addEventListener("click", () => tampilDetail(row.dataset.nama))
  );

  // Rekap individu (berdasarkan pencarian)
  if (keyword && data.length > 0) {
    const hadir = data.filter(d => (d.status || "").toLowerCase() === "hadir").length;
    const terlambat = data.filter(d => (d.keterangan || "").toLowerCase() === "terlambat").length;
    document.getElementById("rekapSiswa").innerHTML =
      `📋 Rekap <b>${data[0].nama}</b>: ${hadir} kali hadir (${terlambat} kali terlambat)`;
  } else {
    document.getElementById("rekapSiswa").innerHTML = "";
  }

  // Perbarui statistik & grafik sesuai data tampil
  updateStatistik(dataTampil);
  updateGrafik(dataTampil);
}

// 📈 Statistik ringkas — mengikuti filter aktif
function updateStatistik(dataSource = semuaData) {
  const total = { hadir: 0, izin: 0, sakit: 0, alfa: 0, terlambat: 0 };
  dataSource.forEach(d => {
    const st = (d.status || "hadir").toLowerCase();
    if (st.includes("izin")) total.izin++;
    else if (st.includes("sakit")) total.sakit++;
    else if (st.includes("alfa")) total.alfa++;
    else total.hadir++;
    if ((d.keterangan || "").toLowerCase() === "terlambat") total.terlambat++;
  });
  document.getElementById("jmlHadir").textContent = total.hadir;
  document.getElementById("jmlIzin").textContent = total.izin;
  document.getElementById("jmlSakit").textContent = total.sakit;
  document.getElementById("jmlAlfa").textContent = total.alfa;
  document.getElementById("jmlTerlambat").textContent = total.terlambat;
}

// 📊 Grafik dinamis sesuai filter
function updateGrafik(dataSource = semuaData) {
  const ctx = document.getElementById("grafikKehadiran").getContext("2d");
  if (chart) chart.destroy();

  const tanggalFilter = filterTanggal.value;

  if (!dataSource || dataSource.length === 0) {
    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Tidak ada data"],
        datasets: [{ label: "Hadir", data: [0], backgroundColor: "#16a34a" }]
      },
      options: { scales: { y: { beginAtZero: true } } }
    });
    return;
  }

  // Jika filter tanggal aktif → tampilkan rekap harian
  if (tanggalFilter) {
    let hadirCount = 0, terlambatCount = 0;
    dataSource.forEach(d => {
      if (!d.waktu?.toDate) return;
      const localDate = d.waktu.toDate();
const tgl = localDate.getFullYear() + "-" +
  String(localDate.getMonth() + 1).padStart(2, "0") + "-" +
  String(localDate.getDate()).padStart(2, "0");
      if (tgl === tanggalFilter) {
        const st = (d.status || "").toLowerCase();
        if (st === "hadir" || st === "") hadirCount++;
        if ((d.keterangan || "").toLowerCase() === "terlambat") terlambatCount++;
      }
    });

    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Hadir", "Terlambat"],
        datasets: [{
          label: `Rekap ${tanggalFilter}`,
          data: [hadirCount, terlambatCount],
          backgroundColor: ["#16a34a", "#dc2626"]
        }]
      },
      options: {
        scales: { y: { beginAtZero: true, precision: 0 } },
        plugins: { title: { display: true, text: `Rekap Kehadiran pada ${tanggalFilter}` } }
      }
    });
    return;
  }

  // Jika tidak ada tanggal → tampilkan grafik mingguan
  const hariMap = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const dataHadir = Array(7).fill(0);
  const dataTerlambat = Array(7).fill(0);

  dataSource.forEach(d => {
    if (d.waktu?.toDate) {
      const day = d.waktu.toDate().getDay();
      const status = (d.status || "").toLowerCase();
      if (status === "hadir" || status === "") dataHadir[day]++;
      if ((d.keterangan || "").toLowerCase() === "terlambat") dataTerlambat[day]++;
    }
  });

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: hariMap,
      datasets: [
        { label: "Hadir", data: dataHadir, backgroundColor: "#16a34a" },
        { label: "Terlambat", data: dataTerlambat, backgroundColor: "#dc2626" }
      ]
    },
    options: {
      scales: { y: { beginAtZero: true, precision: 0 } },
      plugins: { title: { display: true, text: "Grafik Kehadiran Berdasarkan Filter" } }
    }
  });
}

// 🧍 Modal detail per siswa
function tampilDetail(nama) {
  const modal = document.getElementById("modalDetail");
  const detailNama = document.getElementById("detailNama");
  const detailInfo = document.getElementById("detailInfo");
  const ctx = document.getElementById("chartDetail");

  const dataSiswa = semuaData.filter(d => d.nama === nama);
  const hadir = dataSiswa.filter(d => (d.status || "").toLowerCase() === "hadir").length;
  const izin = dataSiswa.filter(d => (d.status || "").toLowerCase() === "izin").length;
  const sakit = dataSiswa.filter(d => (d.status || "").toLowerCase() === "sakit").length;
  const alfa = dataSiswa.filter(d => (d.status || "").toLowerCase() === "alfa").length;
  const terlambat = dataSiswa.filter(d => (d.keterangan || "").toLowerCase() === "terlambat").length;

  detailNama.textContent = `Detail Kehadiran: ${nama}`;
  detailInfo.textContent = `${hadir} hadir | ${izin} izin | ${sakit} sakit | ${alfa} alfa | ${terlambat} terlambat`;

  if (chartDetail) chartDetail.destroy();
  chartDetail = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Hadir", "Izin", "Sakit", "Alfa", "Terlambat"],
      datasets: [{
        data: [hadir, izin, sakit, alfa, terlambat],
        backgroundColor: ["#16a34a", "#eab308", "#3b82f6", "#ef4444", "#f97316"]
      }]
    }
  });

  modal.classList.remove("hidden");
}

document.getElementById("closeModal").addEventListener("click", () => {
  document.getElementById("modalDetail").classList.add("hidden");
});

// 📤 Ekspor Excel
document.getElementById("btnExportExcel").addEventListener("click", () => {
  if (dataTampil.length === 0) return alert("Tidak ada data untuk diekspor!");
  const dataExport = dataTampil.map((d, i) => [
    i + 1,
    d.nama || "-",
    d.kelas || "-",
    d.status || "-",
    d.keterangan || "-",
    d.waktu?.toDate ? d.waktu.toDate().toLocaleString("id-ID") : "-"
  ]);
  const ws = XLSX.utils.aoa_to_sheet([["No", "Nama", "Kelas", "Status", "Keterangan", "Waktu"], ...dataExport]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Absensi");
  XLSX.writeFile(wb, "Rekap_Absensi_Filter.xlsx");
});

// 📄 Ekspor PDF
document.getElementById("btnExportPDF").addEventListener("click", () => {
  if (dataTampil.length === 0) return alert("Tidak ada data untuk diekspor!");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.text("Rekap Absensi Sekolah", 14, 15);
  let y = 25;
  doc.setFontSize(10);
  dataTampil.forEach((d, i) => {
    const teks = `${i + 1}. ${d.nama} | ${d.kelas} | ${d.status} | ${d.keterangan || "-"} | ${
      d.waktu?.toDate ? d.waktu.toDate().toLocaleString("id-ID") : "-"
    }`;
    doc.text(teks, 14, y);
    y += 6;
  });
  doc.save("Rekap_Absensi_Filter.pdf");
});
