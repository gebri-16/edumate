const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const passport = require("./config/passport");
require("dotenv").config();

const app = express();

// Scheduler (auto-selesai & reminder)
require("./scheduler");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// FIX: Gunakan MySQL session store hanya di production (Railway)
// Di localhost pakai MemoryStore agar tidak perlu konek ke FreeSQLDatabase
let sessionStore;
if (process.env.NODE_ENV === 'production') {
  const MySQLStore = require("express-mysql-session")(session);
  sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: 86400000,
    createDatabaseTable: true,
  });
  console.log('Session store: MySQL (production)');
} else {
  console.log('Session store: Memory (development)');
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore, // undefined = MemoryStore di development
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 5 * 60 * 1000, // 5 menit
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
  })
);

// Passport — harus setelah session
app.use(passport.initialize());
app.use(passport.session());

// Static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Root redirect ke login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/login.html'));
});

// Test route
app.get("/api", (req, res) => {
  res.json({ message: "EduMate API berjalan! ✅" });
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/jadwal", require("./routes/jadwal"));
app.use("/api/matching", require("./routes/matching"));
app.use("/api/sesi", require("./routes/sesi"));
app.use("/api/notifikasi", require("./routes/notifikasi"));
app.use("/api/rating", require("./routes/rating"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT} ✅`);
});