const form = document.getElementById("formTambahGuru");
const hasil = document.getElementById("hasilTambah");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    nama: document.getElementById("nama").value,
    email: document.getElementById("email").value,
    password: document.getElementById("password").value,
    mapel: document.getElementById("mapel").value,
    kelas: document.getElementById("kelas").value,
    waliKelas: document.getElementById("waliKelas").checked,
  };

  try {
    const res = await fetch("https://us-central1-sistem-sekolah-6a1d5.cloudfunctions.net/tambahGuru", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    hasil.innerHTML = `<p class="text-success">${result.message}</p>`;
    form.reset();
  } catch (err) {
    console.error(err);
    hasil.innerHTML = `<p class="text-danger">❌ Gagal menambahkan guru!</p>`;
  }
});
