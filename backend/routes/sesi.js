const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');

function formatTanggal(tglStr) {
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const d = new Date(tglStr);
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

// POST /api/sesi — buat ajakan sesi belajar baru
router.post('/', verifyToken, (req, res) => {
  console.log('POST /api/sesi dipanggil, pengirim_id:', req.user.id);
  const pengirim_id = req.user.id;
  const { penerima_id, mata_kuliah, tanggal, jam_mulai, jam_selesai, lokasi, link_meeting } = req.body;

  if (!penerima_id || !mata_kuliah || !tanggal || !jam_mulai || !jam_selesai) {
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
  }

  const query = `
    INSERT INTO sesi_belajar (pengirim_id, penerima_id, mata_kuliah, tanggal, jam_mulai, jam_selesai, lokasi, link_meeting, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `;

  db.query(query, [pengirim_id, penerima_id, mata_kuliah, tanggal, jam_mulai, jam_selesai, lokasi, link_meeting || null], (err, result) => {
    if (err) {
      // Kalau kolom link_meeting belum ada di DB, coba tanpa link_meeting
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        const queryFallback = `
          INSERT INTO sesi_belajar (pengirim_id, penerima_id, mata_kuliah, tanggal, jam_mulai, jam_selesai, lokasi, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        `;
        db.query(queryFallback, [pengirim_id, penerima_id, mata_kuliah, tanggal, jam_mulai, jam_selesai, lokasi], (err2, result2) => {
          if (err2) return res.status(500).json({ success: false, message: 'Gagal buat sesi', error: err2.message });
          kirimNotifAjakan(pengirim_id, penerima_id, mata_kuliah, tanggal, result2.insertId);
          res.json({ success: true, message: 'Ajakan berhasil dikirim!', sesi_id: result2.insertId });
        });
        return;
      }
      return res.status(500).json({ success: false, message: 'Gagal buat sesi', error: err.message });
    }
    kirimNotifAjakan(pengirim_id, penerima_id, mata_kuliah, tanggal, result.insertId);
    res.json({ success: true, message: 'Ajakan berhasil dikirim!', sesi_id: result.insertId });
  });
});

function kirimNotifAjakan(pengirim_id, penerima_id, mata_kuliah, tanggal, sesi_id) {
  db.query('SELECT nama FROM users WHERE id = ?', [pengirim_id], (err, userResult) => {
    if (!err && userResult.length > 0) {
      const namaPengirim = userResult[0].nama;
      const tglFormatted = formatTanggal(tanggal);
      const pesan = `${namaPengirim} mengajakmu belajar ${mata_kuliah} pada ${tglFormatted}`;
      db.query(
        `INSERT INTO notifikasi (user_id, judul, pesan, tipe) VALUES (?, 'Ajakan Belajar Baru', ?, 'ajakan')`,
        [penerima_id, pesan],
        (err) => { if (err) console.error('Gagal insert notif:', err.message); }
      );
    }
  });
}

// GET /api/sesi — ambil semua sesi user
router.get('/', verifyToken, (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT s.*,
      u1.nama as pengirim_nama, u1.foto as pengirim_foto,
      u2.nama as penerima_nama, u2.foto as penerima_foto
    FROM sesi_belajar s
    JOIN users u1 ON s.pengirim_id = u1.id
    JOIN users u2 ON s.penerima_id = u2.id
    WHERE s.pengirim_id = ? OR s.penerima_id = ?
    ORDER BY s.created_at DESC
  `;

  db.query(query, [userId, userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Gagal ambil sesi' });
    res.json({ success: true, sesi: results });
  });
});

// PUT /api/sesi/:id — update status sesi
router.put('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user.id;

  // Ambil data sesi dulu
  db.query('SELECT * FROM sesi_belajar WHERE id = ?', [id], (err, sesiResult) => {
    if (err || sesiResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan' });
    }

    const sesi = sesiResult[0];
    const isPengirim = sesi.pengirim_id === userId;
    const isPenerima = sesi.penerima_id === userId;

    // Validasi hak akses berdasarkan status yang diminta:
    // - 'diterima' / 'ditolak' → hanya penerima
    // - 'ditolak' sebagai pembatalan → pengirim ATAU penerima boleh
    if (status === 'diterima') {
      if (!isPenerima) {
        return res.status(403).json({ success: false, message: 'Hanya penerima yang bisa mengkonfirmasi sesi' });
      }
    } else if (status === 'ditolak') {
      // Baik pengirim maupun penerima boleh batalkan
      if (!isPengirim && !isPenerima) {
        return res.status(403).json({ success: false, message: 'Kamu tidak memiliki akses ke sesi ini' });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Status tidak valid' });
    }

    db.query(
      'UPDATE sesi_belajar SET status = ? WHERE id = ?',
      [status, id],
      (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Gagal update status' });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan' });

        // Kirim notifikasi ke pihak lain
        const targetId = isPengirim ? sesi.penerima_id : sesi.pengirim_id;
        db.query('SELECT nama FROM users WHERE id = ?', [userId], (err, userResult) => {
          if (!err && userResult.length > 0) {
            const namaUser = userResult[0].nama;
            let pesan = '';
            let judul = '';

            if (status === 'diterima') {
              judul = 'Ajakan Belajar Diterima';
              pesan = `${namaUser} menerima ajakanmu belajar ${sesi.mata_kuliah}`;
            } else if (status === 'ditolak') {
              if (isPengirim) {
                // Pengirim yang batalkan — beritahu penerima
                judul = 'Sesi Belajar Dibatalkan';
                pesan = `${namaUser} membatalkan ajakan belajar ${sesi.mata_kuliah}`;
              } else {
                // Penerima yang tolak — beritahu pengirim
                judul = 'Ajakan Belajar Ditolak';
                pesan = `${namaUser} tidak dapat menghadiri sesi ${sesi.mata_kuliah} yang kamu ajukan`;
              }
            }

            if (pesan) {
              db.query(
                `INSERT INTO notifikasi (user_id, judul, pesan, tipe) VALUES (?, ?, ?, 'ajakan')`,
                [targetId, judul, pesan],
                (err) => { if (err) console.error('Gagal insert notif:', err.message); }
              );
            }
          }
        });

        res.json({ success: true, message: `Sesi berhasil ${status}` });
      }
    );
  });
});

// DELETE /api/sesi/:id — hapus sesi dari tampilan
// Hanya sesi dengan status 'ditolak' atau 'selesai' yang bisa dihapus
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  db.query('SELECT * FROM sesi_belajar WHERE id = ?', [id], (err, sesiResult) => {
    if (err || sesiResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan' });
    }

    const sesi = sesiResult[0];

    if (sesi.pengirim_id !== userId && sesi.penerima_id !== userId) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke sesi ini' });
    }

    if (sesi.status !== 'ditolak' && sesi.status !== 'selesai') {
      return res.status(400).json({ success: false, message: 'Hanya sesi selesai atau dibatalkan yang bisa dihapus' });
    }

    db.query('DELETE FROM sesi_belajar WHERE id = ?', [id], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal hapus sesi' });
      res.json({ success: true, message: 'Sesi berhasil dihapus' });
    });
  });
});

module.exports = router;