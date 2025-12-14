import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Jika belum login, kembali ke halaman utama
    window.location.href = "index.html";
  }
});
