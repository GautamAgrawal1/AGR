// index.js
// -------------------------------------------------------
// EJS setup ke saath poora server
// -------------------------------------------------------

require("dotenv").config();
const express    = require("express");
const path       = require("path");
const cookieParser = require("cookie-parser");
const connectDB  = require("./config/database");
const { setUser } = require("./middlewares/auth");
const {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  strictLimiter,
} = require("./middlewares/rateLimiter");

const app = express();

// Database
connectDB();

// -------------------------------------------------------
// EJS SETUP
// -------------------------------------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files — CSS, JS, Images
app.use(express.static(path.join(__dirname, "public")));

// -------------------------------------------------------
// MIDDLEWARE
// -------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(setUser); // Har request pe user set karo

// -------------------------------------------------------
// RATE LIMITING — Redis-based (gracefully degraded if Redis unavailable)
// -------------------------------------------------------
app.use("/api/", generalLimiter);                          // Sab API routes pe
app.use("/api/auth/login",    authLimiter);                // Login brute force protection
app.use("/api/auth/register", authLimiter);                // Signup spam protection
app.use("/api/payment/",      strictLimiter);              // Payment endpoints — strict
app.use("/admin/upload-",     uploadLimiter);              // Photo uploads

// -------------------------------------------------------
// API ROUTES (Backend)
// -------------------------------------------------------
app.use("/api/auth",       require("./routes/auth"));
app.use("/api/restaurant", require("./routes/restaurant"));
app.use("/api/rooms",      require("./routes/rooms"));
app.use("/api/reviews",    require("./routes/reviews"));
app.use("/api/admin",      require("./routes/admin"));
app.use("/api/payment",    require("./routes/payment"));

// -------------------------------------------------------
// PAGE ROUTES (Frontend — EJS pages)
// -------------------------------------------------------
app.use("/", require("./routes/pages"));

// 404 Handler
app.use((req, res) => {
  res.status(404).render("404", { 
    user: req.user || null, 
    title: "404 — AGR Hotel" 
  });
});

// Global Error Handler  
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", {
    user: req.user || null,
    title: "Error — AGR Hotel",
    message: err.message || "Kuch gadbad ho gayi!",
  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
});