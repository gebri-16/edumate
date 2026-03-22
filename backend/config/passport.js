const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./database');
require('dotenv').config();

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback',
  prompt: 'select_account'
},
(accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  const nama = profile.displayName;
  const foto = profile.photos[0].value;

  // Cek apakah user sudah ada di database
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
    if (err) return done(err);

    if (result.length > 0) {
      // User sudah ada, langsung login
      return done(null, result[0]);
    } else {
      // User belum ada, buat akun baru
      db.query(
        'INSERT INTO users (nama, email, foto) VALUES (?, ?, ?)',
        [nama, email, foto],
        (err, newUser) => {
          if (err) return done(err);
          db.query('SELECT * FROM users WHERE id = ?', [newUser.insertId], (err, user) => {
            return done(null, user[0]);
          });
        }
      );
    }
  });
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  db.query('SELECT * FROM users WHERE id = ?', [id], (err, result) => {
    done(err, result[0]);
  });
});

module.exports = passport;