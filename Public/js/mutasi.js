import { db } from "./firebase-config.js";
import { collection, addDoc, onSnapshot, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const form = document.getElementById("formMutasi");
const msg = document.getElementById("msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.innerHTML = "";

  const nis = document.getElementById("nis").value;
  const nama = document.getElementById("nama").value;
  const status = document.getElementById("status").value;
  const keterangan = document.getElementById("keterangan").value;

  try {
    await addDoc(collection(db, "mutasi_siswa"), {
      nis, nama, status, keterangan,
      waktuInput: serverTimestamp()
    });
    msg.innerHTML = `<div class="alert success">Data mutasi disimpan!</div>`;
    form.reset();
  } catch (err) {
    msg.innerHTML = `<div class="alert error">${err.message}</div>`;
  }
});

// Realtime data
const tbody = document.querySelector("#tabelMutasi tbody");
const q = query(collection(db, "mutasi_siswa"), orderBy("waktuInput", "desc"));
onSnapshot(q, (snapshot) => {
  tbody.innerHTML = "";
  snapshot.forEach((doc) => {
    const d = doc.data();
    tbody.innerHTML += `
      <tr>
        <td>${d.nis}</td>
        <td>${d.nama}</td>
        <td>${d.status}</td>
        <td>${d.keterangan}</td>
      </tr>`;
  });
});
