const cron = require('node-cron');
const db = require('./config/database');

// ==================== AUTO SELESAI ====================
// Jalankan setiap 5 menit — cek sesi yang sudah lewat waktu
cron.schedule('*/5 * * * *', () => {
  const query = `
    UPDATE sesi_belajar
    SET status = 'selesai'
    WHERE status = 'diterima'
    AND CONCAT(tanggal, ' ', jam_selesai) < NOW()
  `;

  db.query(query, (err, result) => {
    if (err) {
      console.error('[Scheduler] Gagal auto-selesai sesi:', err.message);
      return;
    }
    if (result.affectedRows > 0) {
      console.log(`[Scheduler] ${result.affectedRows} sesi otomatis ditandai selesai`);

      // Kirim notifikasi ke pengirim & penerima sesi yang baru selesai
      const notifQuery = `
        SELECT s.id, s.pengirim_id, s.penerima_id, s.mata_kuliah,
               u1.nama as pengirim_nama, u2.nama as penerima_nama
        FROM sesi_belajar s
        JOIN users u1 ON s.pengirim_id = u1.id
        JOIN users u2 ON s.penerima_id = u2.id
        WHERE s.status = 'selesai'
        AND CONCAT(s.tanggal, ' ', s.jam_selesai) >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        AND CONCAT(s.tanggal, ' ', s.jam_selesai) < NOW()
      `;

      db.query(notifQuery, (err, sesiList) => {
        if (err || !sesiList.length) return;

        sesiList.forEach(s => {
          const pesan = `Sesimu bersama ${s.penerima_nama} — ${s.mata_kuliah} — telah selesai. Jangan lupa beri rating!`;
          const pesanPenerima = `Sesimu bersama ${s.pengirim_nama} — ${s.mata_kuliah} — telah selesai. Jangan lupa beri rating!`;

          db.query(
            `INSERT INTO notifikasi (user_id, judul, pesan, tipe) VALUES (?, 'Sesi Belajar Selesai', ?, 'sesi')`,
            [s.pengirim_id, pesan], () => {}
          );
          db.query(
            `INSERT INTO notifikasi (user_id, judul, pesan, tipe) VALUES (?, 'Sesi Belajar Selesai', ?, 'sesi')`,
            [s.penerima_id, pesanPenerima], () => {}
          );
        });
      });
    }
  });
});

// ==================== REMINDER H-1 ====================
// Jalankan setiap hari jam 08:00
cron.schedule('0 8 * * *', () => {
  const query = `
    SELECT s.*, 
      u1.nama as pengirim_nama, u2.nama as penerima_nama
    FROM sesi_belajar s
    JOIN users u1 ON s.pengirim_id = u1.id
    JOIN users u2 ON s.penerima_id = u2.id
    WHERE s.status = 'diterima'
    AND DATE(s.tanggal) = DATE(DATE_ADD(NOW(), INTERVAL 1 DAY))
  `;

  db.query(query, (err, sesiList) => {
    if (err) {
      console.error('[Scheduler] Gagal cek reminder H-1:', err.message);
      return;
    }

    sesiList.forEach(s => {
      const jam = s.jam_mulai ? s.jam_mulai.substring(0, 5) : '';
      const pesan = `Besok kamu ada sesi belajar ${s.mata_kuliah} bersama ${s.penerima_nama} pukul ${jam}. Jangan lupa!`;
      const pesanPenerima = `Besok kamu ada sesi belajar ${s.mata_kuliah} bersama ${s.pengirim_nama} pukul ${jam}. Jangan lupa!`;

      db.query(
        `INSERT INTO notifikasi (user_id, judul, pesan, tipe) VALUES (?, 'Pengingat Sesi Besok', ?, 'sesi')`,
        [s.pengirim_id, pesan], () => {}
      );
      db.query(
        `INSERT INTO notifikasi (user_id, judul, pesan, tipe) VALUES (?, 'Pengingat Sesi Besok', ?, 'sesi')`,
        [s.penerima_id, pesanPenerima], () => {}
      );
    });

    if (sesiList.length > 0) {
      console.log(`[Scheduler] Reminder H-1 dikirim untuk ${sesiList.length} sesi`);
    }
  });
});

// ==================== REMINDER 1 JAM SEBELUM ====================
// Jalankan setiap 30 menit
cron.schedule('*/30 * * * *', () => {
  const query = `
    SELECT s.*,
      u1.nama as pengirim_nama, u2.nama as penerima_nama
    FROM sesi_belajar s
    JOIN users u1 ON s.pengirim_id = u1.id
    JOIN users u2 ON s.penerima_id = u2.id
    WHERE s.status = 'diterima'
    AND CONCAT(s.tanggal, ' ', s.jam_mulai) BETWEEN DATE_ADD(NOW(), INTERVAL 55 MINUTE) AND DATE_ADD(NOW(), INTERVAL 65 MINUTE)
  `;

  db.query(query, (err, sesiList) => {
    if (err) {
      console.error('[Scheduler] Gagal cek reminder 1 jam:', err.message);
      return;
    }

    sesiList.forEach(s => {
      const jam = s.jam_mulai ? s.jam_mulai.substring(0, 5) : '';
      const pesan = `Sesimu bersama ${s.penerima_nama} — ${s.mata_kuliah} — dimulai dalam 1 jam (pukul ${jam}). Bersiaplah!`;
      const pesanPenerima = `Sesimu bersama ${s.pengirim_nama} — ${s.mata_kuliah} — dimulai dalam 1 jam (pukul ${jam}). Bersiaplah!`;

      db.query(
        `INSERT INTO notifikasi (user_id, judul, pesan, tipe) VALUES (?, 'Sesi Dimulai dalam 1 Jam', ?, 'sesi')`,
        [s.pengirim_id, pesan], () => {}
      );
      db.query(
        `INSERT INTO notifikasi (user_id, judul, pesan, tipe) VALUES (?, 'Sesi Dimulai dalam 1 Jam', ?, 'sesi')`,
        [s.penerima_id, pesanPenerima], () => {}
      );
    });

    if (sesiList.length > 0) {
      console.log(`[Scheduler] Reminder 1 jam dikirim untuk ${sesiList.length} sesi`);
    }
  });
});

console.log('[Scheduler] ✅ Semua cron job aktif');
module.exports = {};