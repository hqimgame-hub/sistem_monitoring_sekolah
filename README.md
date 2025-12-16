# Sistem Manajemen Sekolah Modern

Aplikasi Sistem Informasi Sekolah berbasis web modern yang dibangun menggunakan Vite, Tailwind CSS, dan Firebase. Aplikasi ini dirancang untuk memudahkan manajemen absensi, pelanggaran siswa, dan data akademik.

## Fitur Utama

-   **Multi-Role Auth**: Login untuk Admin, Kepala Sekolah, Guru, Wali Kelas, dan Ketua Kelas.
-   **Absensi QR Code**: Fitur scan kartu pelajar untuk absensi kehadiran real-time.
-   **Manajemen Pelanggaran**: Input dan rekap data pelanggaran siswa dengan sistem poin.
-   **Dashboard Lengkap**: Visualisasi data untuk setiap role pengguna.
-   **Desain Responsif**: Tampilan mobile-friendly untuk akses dari HP.

## Persyaratan Sistem

-   Node.js (versi 16 atau terbaru)
-   Akun Google Firebase (untuk backend database & auth)

## Cara Instalasi

1.  **Clone Repository**
    ```bash
    git clone https://github.com/username/sistem-sekolah-modern.git
    cd sistem-sekolah-modern
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Konfigurasi Firebase**
    -   Buat project baru di [Firebase Console](https://console.firebase.google.com/).
    -   Aktifkan **Authentication** (Email/Password).
    -   Aktifkan **Firestore Database**.
    -   Aktifkan **Storage**.
    -   Salin file `.env.example` menjadi `.env`:
        ```bash
        cp .env.example .env
        ```
    -   Isi file `.env` dengan konfigurasi project Firebase Anda.

4.  **Jalankan Aplikasi (Development)**
    ```bash
    npm run dev
    ```
    Akses aplikasi di `http://localhost:5173`.

> [!IMPORTANT]
> **PENTING UNTUK SEKOLAH LAIN**
> Jika Anda menggunakan source code ini untuk sekolah Anda sendiri, Anda **WAJIB** mengganti konfigurasi Firebase di file `src/js/firebase_init.js` (atau `.env` jika sudah disetup) dengan konfigurasi Project Firebase milik sekolah Anda sendiri.
> 
> Jika Anda tidak menggantinya, aplikasi akan terhubung ke database demo/default dan data sekolah Anda akan bercampur dengan data orang lain. **Pastikan Anda membuat Project Firebase baru!**

## Deployment

Aplikasi ini dapat dideploy dengan mudah ke platform statis seperti Vercel, Netlify, atau Firebase Hosting.

1.  **Build Project**
    ```bash
    npm run build
    ```
2.  Upload folder `dist` yang terbentuk ke hosting pilihan Anda.

## Lisensi

[MIT](LICENSE)
