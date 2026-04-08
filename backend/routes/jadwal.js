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

// ==================== GET /api/jadwal/user/:id ====================
router.get('/user/:id', verifyToken, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (!targetId || isNaN(targetId))
    return res.status(400).json({ success: false, message: 'ID tidak valid' });

  db.query(
    'SELECT hari, jam_mulai, jam_selesai FROM jadwal_kosong WHERE user_id = ? ORDER BY FIELD(hari,"Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"), jam_mulai',
    [targetId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal ambil jadwal' });
      res.json({ success: true, jadwal: results });
    }
  );
});

// ==================== POST /api/jadwal ====================
router.post('/', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { hari, jam_mulai, jam_selesai, jadwal, replace } = req.body;

  // ── Format BARU: { hari, jam_mulai, jam_selesai } dari jadwal.html ──
  if (hari && jam_mulai && jam_selesai) {
    const hariValid = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
    if (!hariValid.includes(hari))
      return res.status(400).json({ success: false, message: 'Hari tidak valid' });

    const mulai   = jam_mulai.length === 5 ? jam_mulai + ':00' : jam_mulai;
    const selesai = jam_selesai.length === 5 ? jam_selesai + ':00' : jam_selesai;
    const values  = [[userId, hari, mulai, selesai]];

    if (replace === true) {
      db.query('DELETE FROM jadwal_kosong WHERE user_id = ?', [userId], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Gagal hapus jadwal lama' });
        insertJadwal(values, res);
      });
    } else {
      db.query(
        'SELECT id FROM jadwal_kosong WHERE user_id = ? AND hari = ? AND jam_mulai = ?',
        [userId, hari, mulai],
        (err, existing) => {
          if (err) return res.status(500).json({ success: false, message: 'Gagal cek jadwal' });
          if (existing.length > 0)
            return res.json({ success: true, message: 'Jadwal sudah ada' });
          insertJadwal(values, res);
        }
      );
    }
    return;
  }

  // ── Format LAMA: { jadwal: ["Senin Pagi", ...] } dari onboarding & profil ──
  if (!jadwal || jadwal.length === 0)
    return res.status(400).json({ success: false, message: 'Jadwal tidak boleh kosong' });

  const values2 = jadwal
    .filter(j => jadwalMap[j])
    .map(j => [userId, jadwalMap[j].hari, jadwalMap[j].jam_mulai, jadwalMap[j].jam_selesai]);

  if (values2.length === 0)
    return res.status(400).json({ success: false, message: 'Jadwal tidak valid' });

  if (replace === true) {
    db.query('DELETE FROM jadwal_kosong WHERE user_id = ?', [userId], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal hapus jadwal lama' });
      insertJadwal(values2, res);
    });
  } else {
    db.query(
      'SELECT hari, jam_mulai FROM jadwal_kosong WHERE user_id = ?',
      [userId],
      (err, existing) => {
        if (err) return res.status(500).json({ success: false, message: 'Gagal cek jadwal' });
        const existingSet = new Set(existing.map(e => `${e.hari}_${e.jam_mulai}`));
        const newValues   = values2.filter(v => !existingSet.has(`${v[1]}_${v[2]}`));
        if (newValues.length === 0)
          return res.json({ success: true, message: 'Jadwal sudah ada' });
        insertJadwal(newValues, res);
      }
    );
  }
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

// ==================== HELPER ====================
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

module.exports = router;