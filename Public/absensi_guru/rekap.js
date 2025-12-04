import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { firebaseConfig } from "../js/firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const q = query(collection(db, "presensi"), orderBy("createdAt", "desc"));
onSnapshot(q, (snapshot) => {
  const tbody = document.getElementById("tabelPresensi");
  tbody.innerHTML = "";
  snapshot.forEach((doc) => {
    const d = doc.data();
    tbody.innerHTML += `
      <tr>
        <td>${d.nama}</td>
        <td>${d.kelas}</td>
        <td>${d.tanggal}</td>
        <td>${d.jamMasuk}</td>
        <td>${d.status}</td>
      </tr>
    `;
  });
});
