import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// === Konfigurasi Firebase ===
const firebaseConfig = {
  apiKey: "AIzaSyAXg6GUd0Aw1Ku0DmWKN0VNGgrbluO26i8",
  authDomain: "sistem-sekolah-6a1d5.firebaseapp.com",
  projectId: "sistem-sekolah-6a1d5",
  storageBucket: "sistem-sekolah-6a1d5.firebasestorage.app",
  messagingSenderId: "152901594945",
  appId: "1:152901594945:web:a672dd14fe231a89bebbc0"
};

// === Inisialisasi Firebase ===
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// === DOM Elements ===
const formJurnal = document.getElementById("formJurnal");
const tabelBody = document.querySelector("#tabelJurnal tbody");
const msg = document.getElementById("msg");
const logoutBtn = document.getElementById("logoutBtn");
const editId = document.getElementById("editId");
const saveBtn = document.getElementById("saveBtn");
const filterKelas = document.getElementById("filterKelas");
const filterMapel = document.getElementById("filterMapel");
const filterTanggal = document.getElementById("filterTanggal");
const btnFilter = document.getElementById("btnFilter");
const btnReset = document.getElementById("btnReset");

let currentUser = null;

// === Autentikasi ===
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadJurnal();
  } else {
    window.location.href = "/login.html";
  }
});

// === Logout ===
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login.html";
});

// === Simpan / Update Jurnal ===
formJurnal.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    uid: currentUser.uid,
    tanggal: document.getElementById("tanggal").value,
    kelas: document.getElementById("kelas").value.trim(),
    mapel: document.getElementById("mapel").value.trim(),
    kegiatan: document.getElementById("kegiatan").value.trim(),
    tindakLanjut: document.getElementById("tindakLanjut").value.trim(),
    siswaTidakMasuk: document.getElementById("siswaTidakMasuk").value.trim(),
    updated_at: new Date()
  };

  try {
    if (editId.value) {
      // Update
      const jurnalRef = doc(db, "jurnal_guru", editId.value);
      await updateDoc(jurnalRef, data);
      showNotif("✅ Jurnal berhasil diperbarui!", "success");
      saveBtn.textContent = "💾 Simpan Jurnal";
      editId.value = "";
    } else {
      // Tambah baru
      data.created_at = new Date();
      await addDoc(collection(db, "jurnal_guru"), data);
      showNotif("✅ Jurnal berhasil disimpan!", "success");
    }

    formJurnal.reset();
    loadJurnal();
  } catch (err) {
    showNotif("❌ Terjadi kesalahan: " + err.message, "danger");
  }
});

// === Tampilkan Jurnal ===
let currentPage = 1;
const pageSize = 5; // jumlah jurnal per halaman

async function loadJurnal(filter=null){
  const tabel = document.querySelector("#tabelJurnal tbody");
  tabel.innerHTML="";

  let q = query(collection(db,"jurnal_guru"),where("uid","==",currentUser.uid));
  const snap = await getDocs(q);
  let dataList=[];
  snap.forEach(docu=>dataList.push({id:docu.id,...docu.data()}));

  // Filter
  if(filter){
    dataList = dataList.filter(item=>{
      return (!filter.kelas||item.kelas.includes(filter.kelas)) &&
             (!filter.mapel||item.mapel.includes(filter.mapel)) &&
             (!filter.tanggal||item.tanggal===filter.tanggal);
    });
  }

  // Sorting: terbaru ke lama
  dataList.sort((a,b)=>new Date(b.tanggal) - new Date(a.tanggal));

  // Pagination
  const totalPages = Math.ceil(dataList.length / pageSize);
  if(currentPage > totalPages) currentPage = totalPages || 1;
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageData = dataList.slice(start,end);

  if(pageData.length === 0){
    tabel.innerHTML="<tr><td colspan='7' class='text-center'>Tidak ada data</td></tr>";
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  pageData.forEach(item=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${item.tanggal}</td>
      <td>${item.kelas}</td>
      <td>${item.mapel}</td>
      <td>${item.kegiatan}</td>
      <td>${item.tindakLanjut}</td>
      <td>${item.siswaTidakMasuk||"-"}</td>
      <td>
        <button class="btn btn-sm btn-warning me-1" onclick="editJurnal('${item.id}','${item.tanggal}','${item.kelas}','${item.mapel}','${item.kegiatan.replace(/'/g,"&#39;")}','${item.tindakLanjut.replace(/'/g,"&#39;")}','${item.siswaTidakMasuk||""}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="hapusJurnal('${item.id}')">🗑️</button>
      </td>`;
    tabel.appendChild(tr);
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages){
  const container = document.getElementById("pagination");
  container.innerHTML="";

  if(totalPages <=1 ) return;

  const prevBtn = document.createElement("button");
  prevBtn.textContent="Prev";
  prevBtn.disabled = currentPage ===1;
  prevBtn.addEventListener("click",()=>{ currentPage--; loadJurnal(getCurrentFilter()); });
  container.appendChild(prevBtn);

  for(let i=1;i<=totalPages;i++){
    const btn = document.createElement("button");
    btn.textContent=i;
    if(i===currentPage) btn.classList.add("active");
    btn.addEventListener("click",()=>{ currentPage=i; loadJurnal(getCurrentFilter()); });
    container.appendChild(btn);
  }

  const nextBtn = document.createElement("button");
  nextBtn.textContent="Next";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener("click",()=>{ currentPage++; loadJurnal(getCurrentFilter()); });
  container.appendChild(nextBtn);
}

// Helper: ambil filter aktif
function getCurrentFilter(){
  return {
    kelas: document.getElementById("filterKelas").value,
    mapel: document.getElementById("filterMapel").value,
    tanggal: document.getElementById("filterTanggal").value
  };
}

// Reset page ketika filter diterapkan
document.getElementById("btnFilter").addEventListener("click",()=>{
  currentPage =1;
  loadJurnal(getCurrentFilter());
});
document.getElementById("btnReset").addEventListener("click",()=>{
  currentPage =1;
  document.getElementById("filterKelas").value="";
  document.getElementById("filterMapel").value="";
  document.getElementById("filterTanggal").value="";
  loadJurnal();
});

// === Edit Jurnal ===
window.editJurnal = (id, tanggal, kelas, mapel, kegiatan, tindakLanjut, siswaTidakMasuk) => {
  editId.value = id;
  document.getElementById("tanggal").value = tanggal;
  document.getElementById("kelas").value = kelas;
  document.getElementById("mapel").value = mapel;
  document.getElementById("kegiatan").value = kegiatan;
  document.getElementById("tindakLanjut").value = tindakLanjut;
  document.getElementById("siswaTidakMasuk").value = siswaTidakMasuk;
  saveBtn.textContent = "💾 Update Jurnal";
  showNotif("✏️ Mode edit aktif. Setelah ubah data, klik Simpan.", "info");
};

// === Hapus Jurnal ===
window.hapusJurnal = async (id) => {
  if (confirm("Yakin ingin menghapus jurnal ini?")) {
    await deleteDoc(doc(db, "jurnal_guru", id));
    showNotif("🗑️ Jurnal berhasil dihapus!", "warning");
    loadJurnal();
  }
};

// === Filter ===
btnFilter.addEventListener("click", () => {
  const filter = {
    kelas: filterKelas.value.trim(),
    mapel: filterMapel.value.trim(),
    tanggal: filterTanggal.value
  };
  loadJurnal(filter);
});

btnReset.addEventListener("click", () => {
  filterKelas.value = "";
  filterMapel.value = "";
  filterTanggal.value = "";
  loadJurnal();
});

// === Notifikasi ===
function showNotif(text, type = "info") {
  msg.textContent = text;
  msg.className = `mt-2 text-center fw-bold text-${type}`;
  setTimeout(() => {
    msg.textContent = "";
    msg.className = "";
  }, 3000);
}

// === Escape karakter untuk onclick ===
function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
}

// === Muat awal ===
loadJurnal();
