import { db } from "./firebase-config.js";
import { collection, addDoc, onSnapshot, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const form = document.getElementById("formPelanggaran");
const msg = document.getElementById("msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.innerHTML = "";

  const nis = document.getElementById("nis").value;
  const nama = document.getElementById("nama").value;
  const jenis = document.getElementById("jenis").value;
  const keterangan = document.getElementById("keterangan").value;

  try {
    await addDoc(collection(db, "pelanggaran_siswa"), {
      nis, nama, jenis, keterangan,
      waktuInput: serverTimestamp()
    });
    msg.innerHTML = `<div class="alert success">Data pelanggaran disimpan!</div>`;
    form.reset();
  } catch (err) {
    msg.innerHTML = `<div class="alert error">${err.message}</div>`;
  }
});

// Tampilkan data realtime
const tbody = document.querySelector("#tabelPelanggaran tbody");
const q = query(collection(db, "pelanggaran_siswa"), orderBy("waktuInput", "desc"));
onSnapshot(q, (snapshot) => {
  tbody.innerHTML = "";
  snapshot.forEach((doc) => {
    const d = doc.data();
    tbody.innerHTML += `
      <tr>
        <td>${d.nis}</td>
        <td>${d.nama}</td>
        <td>${d.jenis}</td>
        <td>${d.keterangan}</td>
      </tr>`;
  });
});
