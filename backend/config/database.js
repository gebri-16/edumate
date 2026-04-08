const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // FIX TIMEZONE: Kembalikan DATE/DATETIME sebagai string murni
  // agar tidak kena offset UTC → WIB di frontend
  dateStrings: true,
});

// Test koneksi saat startup
db.getConnection((err, connection) => {
  if (err) {
    console.log("Koneksi database gagal:", err.message);
    return;
  }
  console.log("Koneksi database berhasil! ✅");
  connection.release();
});

module.exports = db;``