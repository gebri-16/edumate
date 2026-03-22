const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');

const jadwalMap = {
  'Senin Pagi':     { hari: 'Senin',   jam_mulai: '06:00:00', jam_selesai: '11:00:00' },
  'Senin Siang':    { hari: 'Senin',   jam_mulai: '11:00:00', jam_selesai: '14:00:00' },
  'Senin Sore':     { hari: 'Senin',   jam_mulai: '14:00:00', jam_selesai: '18:00:00' },
  'Senin Malam':    { hari: 'Senin',   jam_mulai: '18:00:00', jam_selesai: '22:00:00' },
  'Selasa Pagi':    { hari: 'Selasa',  jam_mulai: '06:00:00', jam_selesai: '11:00:00' },
  'Selasa Siang':   { hari: 'Selasa',  jam_mulai: '11:00:00', jam_selesai: '14:00:00' },
  'Selasa Sore':    { hari: 'Selasa',  jam_mulai: '14:00:00', jam_selesai: '18:00:00' },
  'Selasa Malam':   { hari: 'Selasa',  jam_mulai: '18:00:00', jam_selesai: '22:00:00' },
  'Rabu Pagi':      { hari: 'Rabu',    jam_mulai: '06:00:00', jam_selesai: '11:00:00' },
  'Rabu Siang':     { hari: 'Rabu',    jam_mulai: '11:00:00', jam_selesai: '14:00:00' },
  'Rabu Sore':      { hari: 'Rabu',    jam_mulai: '14:00:00', jam_selesai: '18:00:00' },
  'Rabu Malam':     { hari: 'Rabu',    jam_mulai: '18:00:00', jam_selesai: '22:00:00' },
  'Kamis Pagi':     { hari: 'Kamis',   jam_mulai: '06:00:00', jam_selesai: '11:00:00' },
  'Kamis Siang':    { hari: 'Kamis',   jam_mulai: '11:00:00', jam_selesai: '14:00:00' },
  'Kamis Sore':     { hari: 'Kamis',   jam_mulai: '14:00:00', jam_selesai: '18:00:00' },
  'Kamis Malam':    { hari: 'Kamis',   jam_mulai: '18:00:00', jam_selesai: '22:00:00' },
  'Jumat Pagi':     { hari: 'Jumat',   jam_mulai: '06:00:00', jam_selesai: '11:00:00' },
  'Jumat Siang':    { hari: 'Jumat',   jam_mulai: '11:00:00', jam_selesai: '14:00:00' },
  'Jumat Sore':     { hari: 'Jumat',   jam_mulai: '14:00:00', jam_selesai: '18:00:00' },
  'Jumat Malam':    { hari: 'Jumat',   jam_mulai: '18:00:00', jam_selesai: '22:00:00' },
  'Sabtu Pagi':     { hari: 'Sabtu',   jam_mulai: '06:00:00', jam_selesai: '11:00:00' },
  'Sabtu Siang':    { hari: 'Sabtu',   jam_mulai: '11:00:00', jam_selesai: '14:00:00' },
  'Sabtu Sore':     { hari: 'Sabtu',   jam_mulai: '14:00:00', jam_selesai: '18:00:00' },
  'Sabtu Malam':    { hari: 'Sabtu',   jam_mulai: '18:00:00', jam_selesai: '22:00:00' },
  'Minggu Pagi':    { hari: 'Minggu',  jam_mulai: '06:00:00', jam_selesai: '11:00:00' },
  'Minggu Siang':   { hari: 'Minggu',  jam_mulai: '11:00:00', jam_selesai: '14:00:00' },
  'Minggu Sore':    { hari: 'Minggu',  jam_mulai: '14:00:00', jam_selesai: '18:00:00' },
  'Minggu Malam':   { hari: 'Minggu',  jam_mulai: '18:00:00', jam_selesai: '22:00:00' },
};

// ==================== POST /api/jadwal ====================
// MODE: tambah jadwal baru tanpa menghapus yang lama (MERGE)
// Kalau jadwal yang sama sudah ada, skip (tidak duplikat)
router.post('/', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { jadwal, replace } = req.body;

  if (!jadwal || jadwal.length === 0) {
    return res.status(400).json({ success: false, message: 'Jadwal tidak boleh kosong' });
  }

  const values = jadwal
    .filter(j => jadwalMap[j])
    .map(j => [userId, jadwalMap[j].hari, jadwalMap[j].jam_mulai, jadwalMap[j].jam_selesai]);

  if (values.length === 0) {
    return res.status(400).json({ success: false, message: 'Jadwal tidak valid' });
  }

  // Kalau replace=true (dari onboarding saat pertama kali setup), baru DELETE dulu
  // Kalau replace=false atau tidak ada (tambah dari jadwal.html / profil), MERGE saja
  if (replace === true) {
    db.query('DELETE FROM jadwal_kosong WHERE user_id = ?', [userId], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal hapus jadwal lama' });
      insertJadwal(values, res);
    });
  } else {
    // MERGE: pakai INSERT IGNORE agar tidak duplikat
    // Perlu unique constraint di DB: UNIQUE(user_id, hari, jam_mulai)
    // Kalau belum ada constraint, kita cek manual dulu
    db.query(
      'SELECT hari, jam_mulai FROM jadwal_kosong WHERE user_id = ?',
      [userId],
      (err, existing) => {
        if (err) return res.status(500).json({ success: false, message: 'Gagal cek jadwal' });

        // Filter values yang belum ada di database
        const existingSet = new Set(existing.map(e => `${e.hari}_${e.jam_mulai}`));
        const newValues = values.filter(v => !existingSet.has(`${v[1]}_${v[2]}`));

        if (newValues.length === 0) {
          return res.json({ success: true, message: 'Jadwal sudah ada, tidak ada yang ditambahkan' });
        }

        insertJadwal(newValues, res);
      }
    );
  }
});

function insertJadwal(values, res) {
  db.query(
    'INSERT INTO jadwal_kosong (user_id, hari, jam_mulai, jam_selesai) VALUES ?',
    [values],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal simpan jadwal', error: err.message });
      res.json({ success: true, message: 'Jadwal berhasil disimpan' });
    }
  );
}

// ==================== GET /api/jadwal ====================
router.get('/', verifyToken, (req, res) => {
  const userId = req.user.id;
  db.query(
    'SELECT * FROM jadwal_kosong WHERE user_id = ? ORDER BY FIELD(hari,"Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"), jam_mulai',
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal ambil jadwal' });
      res.json({ success: true, jadwal: results });
    }
  );
});

// ==================== DELETE /api/jadwal/:id ====================
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  db.query(
    'DELETE FROM jadwal_kosong WHERE id = ? AND user_id = ?',
    [id, userId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal hapus jadwal' });
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Jadwal tidak ditemukan' });
      res.json({ success: true, message: 'Jadwal berhasil dihapus' });
    }
  );
});

module.exports = router;