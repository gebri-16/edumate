const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// ==================== GOOGLE OAuth ====================
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account'
}));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/pages/login.html' }),
  authController.googleCallback
);

// ==================== USER DATA ====================
router.get('/me', verifyToken, authController.getMe);
router.put('/profil', verifyToken, authController.updateProfil);
router.put('/profil-belajar', verifyToken, authController.updateProfilBelajar);

// ==================== LOGOUT ====================
router.post('/logout', verifyToken, authController.logout);

module.exports = router;