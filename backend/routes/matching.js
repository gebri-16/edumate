const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');

// ==================== ALGORITMA SCORING MATCHING ====================
function hitungSkor(userA, userB, jadwalA, jadwalB) {
  let skor = 0;

  // 1. Skill/Mata Kuliah sama (30 poin)
  if (userA.skill && userB.skill) {
    const skillA = userA.skill.toLowerCase().split(',').map(s => s.trim());
    const skillB = userB.skill.toLowerCase().split(',').map(s => s.trim());
    const skillSama = skillA.some(s => skillB.includes(s));
    if (skillSama) skor += 30;
  }

  // 2. Topik belajar sama (25 poin)
  if (userA.topik_belajar && userB.topik_belajar) {
    const topikA = userA.topik_belajar.toLowerCase().split(',').map(s => s.trim());
    const topikB = userB.topik_belajar.toLowerCase().split(',').map(s => s.trim());
    const topikSama = topikA.some(t => topikB.includes(t));
    if (topikSama) skor += 25;
  }

  // 3. Jadwal nyambung (20 poin)
  if (jadwalA.length > 0 && jadwalB.length > 0) {
    const jadwalASet = jadwalA.map(j => j.hari);
    const jadwalBSet = jadwalB.map(j => j.hari);
    const jadwalSama = jadwalASet.some(h => jadwalBSet.includes(h));
    if (jadwalSama) skor += 20;
  }

  // 4. Lokasi cocok (15 poin)
  if (userA.lokasi_belajar && userB.lokasi_belajar) {
    if (
      userA.lokasi_belajar.toLowerCase() === userB.lokasi_belajar.toLowerCase() ||
      userA.lokasi_belajar.toLowerCase() === 'online' ||
      userB.lokasi_belajar.toLowerCase() === 'online'
    ) {
      skor += 15;
    }
  }

  // 5. Gaya belajar sama (10 poin)
  if (userA.gaya_belajar && userB.gaya_belajar) {
    if (userA.gaya_belajar.toLowerCase() === userB.gaya_belajar.toLowerCase()) {
      skor += 10;
    }
  }

  return skor;
}

// GET /api/matching
router.get('/', verifyToken, (req, res) => {
  const userId = req.user.id;

  // 1. Ambil profil user yang sedang login
  const queryUserSaya = `
    SELECT u.id, u.nama, u.email, u.foto, u.jurusan, u.universitas,
           pb.skill, pb.topik_belajar, pb.tingkat_kemampuan, pb.gaya_belajar, pb.lokasi_belajar
    FROM users u
    LEFT JOIN profil_belajar pb ON u.id = pb.user_id
    WHERE u.id = ?
  `;

  db.query(queryUserSaya, [userId], (err, userSayaResult) => {
    if (err) return res.status(500).json({ success: false, message: 'Error ambil profil saya' });
    if (userSayaResult.length === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    const userSaya = userSayaResult[0];

    // 2. Ambil jadwal user yang sedang login
    db.query('SELECT * FROM jadwal_kosong WHERE user_id = ?', [userId], (err, jadwalSaya) => {
      if (err) return res.status(500).json({ success: false, message: 'Error ambil jadwal saya' });

      // 3. Ambil semua user lain beserta profil belajar
      const querySemuaUser = `
        SELECT u.id, u.nama, u.email, u.foto, u.jurusan, u.universitas,
               pb.skill, pb.topik_belajar, pb.tingkat_kemampuan, pb.gaya_belajar, pb.lokasi_belajar
        FROM users u
        LEFT JOIN profil_belajar pb ON u.id = pb.user_id
        WHERE u.id != ?
      `;

      db.query(querySemuaUser, [userId], (err, semuaUser) => {
        if (err) return res.status(500).json({ success: false, message: 'Error ambil semua user' });

        if (semuaUser.length === 0) {
          return res.json({ success: true, matches: [] });
        }

        // 4. Ambil jadwal semua user lain
        const userIds = semuaUser.map(u => u.id);
        db.query('SELECT * FROM jadwal_kosong WHERE user_id IN (?)', [userIds], (err, semuaJadwal) => {
          if (err) return res.status(500).json({ success: false, message: 'Error ambil jadwal user lain' });

          // 5. Hitung skor matching untuk setiap user
          const matches = semuaUser.map(userLain => {
            const jadwalLain = semuaJadwal.filter(j => j.user_id === userLain.id);
            const skor = hitungSkor(userSaya, userLain, jadwalSaya, jadwalLain);
            return {
              ...userLain,
              skor,
              persentase: skor
            };
          });

          // 6. Tampilkan SEMUA user, urutkan dari skor tertinggi
          // Tidak ada filter skor > 0 agar semua user lain tetap muncul
          const hasil = matches.sort((a, b) => b.skor - a.skor);

          res.json({ success: true, matches: hasil });
        });
      });
    });
  });
});

module.exports = router;