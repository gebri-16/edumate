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
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/login.html'));
});
app.use(express.urlencoded({ extended: true }));

// Session - dibutuhkan untuk Google OAuth
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
  }),
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.static("frontend"));

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
