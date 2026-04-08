const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');

// GET /api/notifikasi — ambil semua notifikasi user
router.get('/', verifyToken, (req, res) => {
  const userId = req.user.id;

  db.query(
    'SELECT * FROM notifikasi WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal ambil notifikasi' });
      res.json({ success: true, notifikasi: results });
    }
  );
});

// PUT /api/notifikasi/baca-semua — tandai semua notifikasi sudah dibaca
// PENTING: route ini harus di atas /:id agar tidak bentrok
router.put('/baca-semua', verifyToken, (req, res) => {
  const userId = req.user.id;

  db.query(
    'UPDATE notifikasi SET is_read = 1 WHERE user_id = ?', 
    [userId],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal update notifikasi' });
      res.json({ success: true, message: 'Semua notifikasi ditandai dibaca' });
    }
  );
});

// GET /api/notifikasi/unread-count — jumlah notifikasi belum dibaca
router.get('/unread-count', verifyToken, (req, res) => {
  const userId = req.user.id;

  db.query(
    'SELECT COUNT(*) as count FROM notifikasi WHERE user_id = ? AND is_read = 0',
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal ambil count' });
      res.json({ success: true, count: results[0].count });
    }
  );
});

// PUT /api/notifikasi/:id/baca — tandai satu notifikasi sudah dibaca
router.put('/:id/baca', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  db.query(
    'UPDATE notifikasi SET is_read = 1 WHERE id = ? AND user_id = ?',
    [id, userId],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal update notifikasi' });
      res.json({ success: true, message: 'Notifikasi ditandai dibaca' });
    }
  );
});

// DELETE /api/notifikasi/hapus-semua — hapus semua notifikasi yang sudah dibaca
router.delete('/hapus-semua', verifyToken, (req, res) => {
  const userId = req.user.id;

  db.query(
    'DELETE FROM notifikasi WHERE user_id = ? AND is_read = 1',
    [userId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal hapus notifikasi' });
      res.json({ success: true, message: `${result.affectedRows} notifikasi berhasil dihapus` });
    }
  );
});

// DELETE /api/notifikasix:id — hapus satu notifikasi
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  db.query(
    'DELETE FROM notifikasi WHERE id = ? AND user_id = ?',
    [id, userId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal hapus notifikasi' });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Notifikasi tidak ditemukan' });
      res.json({ success: true, message: 'Notifikasi berhasil dihapus' });
    }
  );
});

module.exports = router;