const express = require('express');
const router  = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// ==================== GOOGLE OAUTH ====================
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: true }, (err, user, info) => {
    if (err || !user) {
      console.error('OAuth error:', err || info);
      return res.redirect('/pages/login.html?error=oauth_failed');
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) return res.redirect('/pages/login.html?error=login_failed');
      next();
    });
  })(req, res, next);
}, authController.googleCallback);

router.get('/token-exchange', authController.tokenExchange);

// ==================== STATS PUBLIK ====================
// Tidak butuh login — untuk halaman login
router.get('/stats', authController.getPublicStats);

// ==================== USER ====================
router.get('/me', verifyToken, authController.getMe);
router.get('/user/:id', verifyToken, authController.getUserById);
router.post('/ping', verifyToken, authController.ping);
router.put('/profil', verifyToken, authController.updateProfil);
router.put('/profil-belajar', verifyToken, authController.updateProfilBelajar);

// ==================== LOGOUT ====================
router.post('/logout', authController.logout);

module.exports = router;