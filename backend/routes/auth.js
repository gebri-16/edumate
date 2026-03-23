const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// ==================== GOOGLE OAUTH ====================

// Step 1: Redirect ke halaman login Google
// FIX: tambahkan prompt: 'select_account' agar Google selalu
// menampilkan pilihan akun, tidak auto-login ke akun terakhir
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

// Step 2: Google redirect balik ke sini setelah user pilih akun
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', {
    session: true
  }, (err, user, info) => {
    if (err || !user) {
      console.error('OAuth error:', err || info);
      return res.redirect('/pages/login.html?error=oauth_failed');
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) return res.redirect('/pages/login.html?error=login_failed');
      next();
    });
  })(req, res, next);
},
  authController.googleCallback
);

// Step 3: FIX — endpoint token-exchange (BARU)
// Mengambil token dari session sementara lalu kirim ke browser
// Menggantikan pola embed token langsung di HTML string
router.get('/token-exchange', authController.tokenExchange);

// ==================== USER ====================

// Ambil data user yang sedang login (butuh JWT)
router.get('/me', verifyToken, authController.getMe);

// Update profil dasar
router.put('/profil', verifyToken, authController.updateProfil);

// Update profil belajar
router.put('/profil-belajar', verifyToken, authController.updateProfilBelajar);

// ==================== LOGOUT ====================

// FIX: pakai POST untuk logout (lebih aman dari GET)
// GET logout rentan CSRF — siapapun bisa embed link logout
router.post('/logout', authController.logout);

module.exports = router;