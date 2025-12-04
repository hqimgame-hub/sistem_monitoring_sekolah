import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const loginForm = document.getElementById("loginForm");
const dashboardSection = document.getElementById("dashboardSection");
const loginSection = document.getElementById("loginSection");
const loginMessage = document.getElementById("loginMessage");
const dashboardTitle = document.getElementById("dashboardTitle");
const userEmail = document.getElementById("userEmail");
const btnLogout = document.getElementById("btnLogout");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginMessage.textContent = "Login berhasil!";
    dashboardTitle.textContent = `Dashboard ${role === "guru" ? "Guru" : "Admin"}`;
  } catch (error) {
    loginMessage.textContent = "Login gagal: " + error.message;
  }
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

// Pantau status login
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");
    userEmail.textContent = user.email;
  } else {
    loginSection.classList.remove("hidden");
    dashboardSection.classList.add("hidden");
  }
});
