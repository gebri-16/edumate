const db = require('../config/database');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ==================== HELPER: cek status online ====================
// User dianggap online jika last_active dalam 5 menit terakhir
function getOnlineStatus(lastActive) {
  if (!lastActive) return { online: false, label: 'Tidak diketahui' };
  const diff  = Date.now() - new Date(lastActive).getTime();
  const menit = Math.floor(diff / 60000);
  if (menit < 5)  return { online: true,  label: 'Online' };
  if (menit < 60) return { online: false, label: `${menit} menit lalu` };
  const jam = Math.floor(menit / 60);
  if (jam < 24)   return { online: false, label: `${jam} jam lalu` };
  const hari = Math.floor(jam / 24);
  if (hari === 1) return { online: false, label: 'Kemarin' };
  return { online: false, label: `${hari} hari lalu` };
}

// ==================== GOOGLE CALLBACK ====================
exports.googleCallback = (req, res) => {
  req.session.regenerate((err) => {
    if (err) {
      console.error('Session regenerate error:', err);
      return res.redirect('/pages/login.html?error=session');
    }
    const user = req.user;
    if (!user) return res.redirect('/pages/login.html?error=no_user');

    const token = jwt.sign(
      { id: user.id, nama: user.nama, email: user.email, foto: user.foto },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const sudahIsiProfil = user.jurusan !== null && user.jurusan !== undefined && user.jurusan !== '';

    req.session.pendingToken   = token;
    req.session.redirectTarget = sudahIsiProfil ? 'dashboard' : 'onboarding';

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
exports.tokenExchange = (req, res) => {
  const token         = req.session.pendingToken;
  const redirectTarget = req.session.redirectTarget;
  if (!token) return res.redirect('/pages/login.html?error=no_token');

  delete req.session.pendingToken;
  delete req.session.redirectTarget;

  const page = redirectTarget === 'dashboard' ? 'dashboard' : 'onboarding';
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
      u.id, u.nama, u.email, u.foto, u.jurusan, u.universitas,
      u.bio, u.no_hp, u.last_active, u.created_at,
      pb.skill, pb.topik_belajar, pb.tingkat_kemampuan,
      pb.gaya_belajar, pb.lokasi_belajar
    FROM users u
    LEFT JOIN profil_belajar pb ON u.id = pb.user_id
    WHERE u.id = ?
  `;
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    const user   = results[0];
    const status = getOnlineStatus(user.last_active);
    res.json({ success: true, user: { ...user, ...status } });
  });
};

// ==================== GET USER BY ID (PROFIL PUBLIK) ====================
exports.getUserById = (req, res) => {
  const targetId = parseInt(req.params.id);
  if (!targetId || isNaN(targetId)) {
    return res.status(400).json({ success: false, message: 'ID tidak valid' });
  }
  const query = `
    SELECT
      u.id, u.nama, u.foto, u.jurusan, u.universitas,
      u.bio, u.no_hp, u.last_active, u.created_at,
      pb.skill, pb.topik_belajar, pb.tingkat_kemampuan,
      pb.gaya_belajar, pb.lokasi_belajar
    FROM users u
    LEFT JOIN profil_belajar pb ON u.id = pb.user_id
    WHERE u.id = ?
  `;
  db.query(query, [targetId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    const user   = results[0];
    const status = getOnlineStatus(user.last_active);
    res.json({ success: true, user: { ...user, ...status } });
  });
};

// ==================== PING (update last_active) ====================
// Dipanggil frontend setiap 60 detik selama user aktif
exports.ping = (req, res) => {
  const userId = req.user.id;
  db.query('UPDATE users SET last_active = NOW() WHERE id = ?', [userId], (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
};

// ==================== UPDATE PROFIL ====================
exports.updateProfil = (req, res) => {
  const userId = req.user.id;
  const { nama, jurusan, universitas, bio, no_hp } = req.body;
  const sanitizedHp = no_hp ? no_hp.replace(/[^\d\s\+\-]/g, '').trim() : null;
  db.query(
    `UPDATE users SET nama=?, jurusan=?, universitas=?, bio=?, no_hp=? WHERE id=?`,
    [nama, jurusan, universitas, bio, sanitizedHp, userId],
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


// ==================== PUBLIC STATS (tanpa login) ====================
exports.getPublicStats = (req, res) => {
  const db = require('../config/database');

  // Jalankan 3 query paralel
  const queryTotal   = 'SELECT COUNT(*) as total FROM users';
  const queryOnline  = "SELECT COUNT(*) as online FROM users WHERE last_active >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)";
  const querySesi    = "SELECT COUNT(*) as sesi FROM sesi_belajar WHERE status = 'selesai'";

  let results = {};
  let done = 0;

  const finish = () => {
    done++;
    if (done === 3) {
      res.json({
        success: true,
        total_users:  results.total  || 0,
        online_users: results.online || 0,
        total_sesi:   results.sesi   || 0,
      });
    }
  };

  db.query(queryTotal,  (err, r) => { results.total  = err ? 0 : r[0].total;  finish(); });
  db.query(queryOnline, (err, r) => { results.online = err ? 0 : r[0].online; finish(); });
  db.query(querySesi,   (err, r) => { results.sesi   = err ? 0 : r[0].sesi;   finish(); });
};

// ==================== LOGOUT ====================
// Ganti exports.logout:
exports.logout = (req, res) => {
  const userId = req.user ? req.user.id : null;

  // Reset last_active saat logout agar langsung offline
  if (userId) {
    db.query('UPDATE users SET last_active = NULL WHERE id = ?', [userId], () => {});
  }

  req.logout((logoutErr) => {
    if (logoutErr) console.error('Logout error:', logoutErr);
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error('Session destroy error:', destroyErr);
        return res.status(500).json({ success: false, message: 'Gagal logout' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Logout berhasil' });
    });
  });
};