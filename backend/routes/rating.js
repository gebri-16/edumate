const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');

// POST /api/rating — beri rating setelah sesi selesai
router.post('/', verifyToken, (req, res) => {
  const pemberi_id = req.user.id;
  const { sesi_id, penerima_id, nilai, review } = req.body;

  if (!sesi_id || !penerima_id || !nilai) {
    return res.status(400).json({ success: false, message: 'sesi_id, penerima_id, dan nilai wajib diisi' });
  }

  if (nilai < 1 || nilai > 5) {
    return res.status(400).json({ success: false, message: 'Nilai rating harus antara 1–5' });
  }

  // Cek apakah sudah pernah beri rating untuk sesi ini
  db.query(
    'SELECT id FROM rating WHERE sesi_id = ? AND pemberi_id = ?',
    [sesi_id, pemberi_id],
    (err, existing) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'Kamu sudah memberi rating untuk sesi ini' });
      }

      db.query(
        'INSERT INTO rating (sesi_id, pemberi_id, penerima_id, nilai, review) VALUES (?, ?, ?, ?, ?)',
        [sesi_id, pemberi_id, penerima_id, nilai, review || null],
        (err, result) => {
          if (err) return res.status(500).json({ success: false, message: 'Gagal simpan rating', error: err.message });

          // Kirim notifikasi ke penerima rating
          db.query('SELECT nama FROM users WHERE id = ?', [pemberi_id], (err, userResult) => {
            if (!err && userResult.length > 0) {
              const namaPemberi = userResult[0].nama;
              const bintang = '★'.repeat(nilai) + '☆'.repeat(5 - nilai);
              const pesan = `${namaPemberi} memberimu rating ${bintang} (${nilai}/5)${review ? ` — "${review}"` : ''}`;
              db.query(
                `INSERT INTO notifikasi (user_id, judul, pesan, tipe) VALUES (?, 'Kamu Mendapat Rating Baru!', ?, 'rating')`,
                [penerima_id, pesan],
                () => {}
              );
            }
          });

          res.json({ success: true, message: 'Rating berhasil dikirim!', rating_id: result.insertId });
        }
      );
    }
  );
});


// GET /api/rating/diberikan — ambil semua rating yang diberikan user
router.get('/diberikan', verifyToken, (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT r.*, u.nama as penerima_nama, u.foto as penerima_foto
    FROM rating r
    JOIN users u ON r.penerima_id = u.id
    WHERE r.pemberi_id = ?
    ORDER BY r.created_at DESC
  `;
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Gagal ambil rating' });
    res.json({ success: true, rating: results });
  });
});

// GET /api/rating/:userId — ambil semua rating untuk user tertentu
router.get('/:userId', verifyToken, (req, res) => {
  const { userId } = req.params;

  const query = `
    SELECT r.*, u.nama as pemberi_nama, u.foto as pemberi_foto
    FROM rating r
    JOIN users u ON r.pemberi_id = u.id
    WHERE r.penerima_id = ?
    ORDER BY r.created_at DESC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Gagal ambil rating' });

    const rataRata = results.length > 0
      ? (results.reduce((sum, r) => sum + r.nilai, 0) / results.length).toFixed(1)
      : null;

    res.json({ success: true, rating: results, rata_rata: rataRata, total: results.length });
  });
});

// GET /api/rating/sesi/:sesiId — cek apakah sudah beri rating untuk sesi ini
router.get('/sesi/:sesiId', verifyToken, (req, res) => {
  const { sesiId } = req.params;
  const userId = req.user.id;

  db.query(
    'SELECT id FROM rating WHERE sesi_id = ? AND pemberi_id = ?',
    [sesiId, userId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error' });
      res.json({ success: true, sudahRating: results.length > 0 });
    }
  );
});

module.exports = router;