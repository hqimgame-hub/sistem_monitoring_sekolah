const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();
const corsHandler = cors({origin: true});

// ===================================================
// 🚀 Cloud Function: Tambah Guru + Role Wali Kelas
// ===================================================
exports.tambahGuru = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method not allowed");
    }

    const {email, password, nama, mapel, kelas, role, waliKelas} = req.body;

    if (!email || !password || !nama) {
      return res.status(400).send("Data tidak lengkap");
    }

    try {
      // 1️⃣ Buat akun di Authentication
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: nama,
      });

      // 2️⃣ Tentukan role dan status wali kelas
      const dataGuru = {
        uid: userRecord.uid,
        nama,
        email,
        mapel: mapel || "-",
        kelas: kelas || "-",
        role: role || "guru",
        status: "aktif",
        dibuatPada: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (waliKelas === true || waliKelas === "true") {
        dataGuru.role = "wali_kelas";
        dataGuru.kelas_diampu = kelas || "-";
      }

      // 3️⃣ Simpan ke Firestore
      await db.collection("guru").doc(userRecord.uid).set(dataGuru);

      return res.status(200).json({
        message: `✅ Guru ${nama} berhasil dibuat sebagai ${dataGuru.role}.`,
        uid: userRecord.uid,
      });
    } catch (err) {
      console.error("❌ Error:", err);
      return res.status(500).json({error: err.message});
    }
  });
});
