const db = require('../config/database');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ==================== GOOGLE CALLBACK ====================
exports.googleCallback = (req, res) => {
  const user = req.user;
  const token = jwt.sign(
    { id: user.id, nama: user.nama, email: user.email, foto: user.foto },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  const sudahIsiProfil = user.jurusan !== null && user.jurusan !== undefined && user.jurusan !== '';
  console.log('User jurusan:', user.jurusan);
  console.log('Redirect ke:', sudahIsiProfil ? 'dashboard' : 'onboarding');

  if (sudahIsiProfil) {
    res.send(`
      <!DOCTYPE html><html><body>
      <script>
        localStorage.setItem('sb_token', '${token}');
        window.location.href = '/pages/dashboard.html';
      </script>
      </body></html>
    `);
  } else {
    res.send(`
      <!DOCTYPE html><html><body>
      <script>
        localStorage.setItem('sb_token', '${token}');
        window.location.href = '/pages/onboarding.html';
      </script>
      </body></html>
    `);
  }
};
// ==================== GET CURRENT USER ====================
exports.getMe = (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT 
      u.id, u.nama, u.email, u.foto, u.jurusan, u.universitas, u.bio,
      pb.skill, pb.topik_belajar, pb.tingkat_kemampuan, pb.gaya_belajar, pb.lokasi_belajar
    FROM users u
    LEFT JOIN profil_belajar pb ON u.id = pb.user_id
    WHERE u.id = ?
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }
    res.json({ success: true, user: results[0] });
  });
};

// ==================== UPDATE PROFIL ====================
exports.updateProfil = (req, res) => {
  const userId = req.user.id;
  const { nama, jurusan, universitas, bio } = req.body;

  db.query(
    `UPDATE users SET nama=?, jurusan=?, universitas=?, bio=? WHERE id=?`,
    [nama, jurusan, universitas, bio, userId],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal update profil' });
      res.json({ success: true, message: 'Profil berhasil diupdate' });
    }
  );
};

// ==================== UPDATE PROFIL BELAJAR ====================
exports.updateProfilBelajar = (req, res) => {
  const userId = req.user.id;
  const { skill, topik_belajar, tingkat_kemampuan, gaya_belajar, lokasi_belajar } = req.body;

  const query = `
    INSERT INTO profil_belajar (user_id, skill, topik_belajar, tingkat_kemampuan, gaya_belajar, lokasi_belajar)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      skill = VALUES(skill),
      topik_belajar = VALUES(topik_belajar),
      tingkat_kemampuan = VALUES(tingkat_kemampuan),
      gaya_belajar = VALUES(gaya_belajar),
      lokasi_belajar = VALUES(lokasi_belajar)
  `;

  db.query(query, [userId, skill, topik_belajar, tingkat_kemampuan, gaya_belajar, lokasi_belajar], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Gagal update profil belajar' });
    res.json({ success: true, message: 'Profil belajar berhasil diupdate' });
  });
};

// ==================== LOGOUT ====================
exports.logout = (req, res) => {
  req.logout(() => {
    res.json({ success: true, message: 'Logout berhasil' });
  });
};