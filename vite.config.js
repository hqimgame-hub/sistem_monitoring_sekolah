import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard_admin: resolve(__dirname, 'dashboard_admin.html'),
        dashboard_guru: resolve(__dirname, 'dashboard_guru.html'),
        dashboard_kepsek: resolve(__dirname, 'dashboard_kepsek.html'),
        dashboard_wali_kelas: resolve(__dirname, 'dashboard_wali_kelas.html'),
        dashboard_absensi: resolve(__dirname, 'dashboard_absensi.html'),
        absensi_kelas: resolve(__dirname, 'absensi_kelas.html'),
        inputpelanggaran: resolve(__dirname, 'inputpelanggaran.html'),
        input_keterangan: resolve(__dirname, 'input_keterangan.html'),
        // Tambahkan file HTML lain di sini jika ada
      },
    },
    outDir: 'dist', // Output folder standard Vite
    target: 'esnext',
  },
  publicDir: 'Public', // Folder aset statis lama
});
