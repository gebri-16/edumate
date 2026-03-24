const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // FIX: Tambahan untuk handle FreeSQLDatabase timeout
  enableKeepAlive: true,        // kirim keepalive agar koneksi tidak diputus
  keepAliveInitialDelay: 10000, // mulai keepalive setelah 10 detik
  connectTimeout: 10000,        // timeout koneksi 10 detik
  acquireTimeout: 10000,        // timeout ambil koneksi dari pool
  idleTimeout: 60000,           // hapus koneksi idle setelah 60 detik
});

// FIX: Test koneksi saat startup
db.getConnection((err, connection) => {
  if (err) {
    console.log("Koneksi database gagal:", err.message);
    return;
  }
  console.log("Koneksi database berhasil! ✅");
  connection.release();
});

// FIX: Keepalive query setiap 5 menit
// FreeSQLDatabase memutus koneksi idle — ini mencegahnya
setInterval(() => {
  db.query('SELECT 1', (err) => {
    if (err) {
      console.log('[DB] Keepalive gagal:', err.message);
    }
  });
}, 5 * 60 * 1000); // setiap 5 menit

module.exports = db;