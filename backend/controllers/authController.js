const db = require('../config/database');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ==================== GOOGLE CALLBACK ====================
exports.googleCallback = (req, res) => {
  // FIX: Regenerate session untuk cegah session fixation
  // (mencegah session user lama dipakai user baru)
  req.session.regenerate((err) => {
    if (err) {
      console.error('Session regenerate error:', err);
      return res.redirect('/pages/login.html?error=session');
    }

    const user = req.user;

    if (!user) {
      return res.redirect('/pages/login.html?error=no_user');
    }

    const token = jwt.sign(
      { id: user.id, nama: user.nama, email: user.email, foto: user.foto },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const sudahIsiProfil =
      user.jurusan !== null &&
      user.jurusan !== undefined &&
      user.jurusan !== '';

    console.log('User email:', user.email);
    console.log('User jurusan:', user.jurusan);
    console.log('Redirect ke:', sudahIsiProfil ? 'dashboard' : 'onboarding');

    // FIX: Simpan token di session sementara, BUKAN embed langsung di HTML
    // Embed token di HTML string rentan terhadap caching browser
    req.session.pendingToken = token;
    req.session.redirectTarget = sudahIsiProfil ? 'dashboard' : 'onboarding';

    // Simpan session dulu sebelum redirect
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('Session save error:', saveErr);
        return res.redirect('/pages/login.html?error=session');
      }
      res.redirect('/api/auth/token-exchange');
    });
  });
};

// ==================== TOKEN EXCHANGE ====================
// FIX: Endpoint baru — ambil token dari session lalu hapus setelah dipakai
// Ini menggantikan pola embed token langsung di HTML
exports.tokenExchange = (req, res) => {
  const token = req.session.pendingToken;
  const redirectTarget = req.session.redirectTarget;

  if (!token) {
    return res.redirect('/pages/login.html?error=no_token');
  }

  // Hapus dari session setelah diambil agar tidak bisa dipakai ulang
  delete req.session.pendingToken;
  delete req.session.redirectTarget;

  const page = redirectTarget === 'dashboard' ? 'dashboard' : 'onboarding';

  // FIX: localStorage.removeItem dulu sebelum setItem
  // agar token user sebelumnya benar-benar terhapus
  // FIX: JSON.stringify(token) untuk escape karakter aman (cegah XSS)
  // FIX: window.location.replace agar halaman login tidak masuk history browser
  res.send(`
    <!DOCTYPE html>
    <html>
      <body>
        <script>
          localStorage.removeItem('sb_token');
          localStorage.setItem('sb_token', ${JSON.stringify(token)});
          window.location.replace('/pages/${page}.html');
        </script>
      </body>
    </html>
  `);
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
// FIX: session.destroy() agar session server benar-benar dihapus
// (bukan hanya req.logout() yang hanya unset req.user)
exports.logout = (req, res) => {
  req.logout((logoutErr) => {
    if (logoutErr) {
      console.error('Logout error:', logoutErr);
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error('Session destroy error:', destroyErr);
        return res.status(500).json({ success: false, message: 'Gagal logout' });
      }
      res.clearCookie('connect.sid'); // hapus cookie session di browser
      res.json({ success: true, message: 'Logout berhasil' });
    });
  });
};