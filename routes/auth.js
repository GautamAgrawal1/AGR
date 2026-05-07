// routes/auth.js
// -------------------------------------------------------
// ROUTES:
// POST /api/auth/signup  — Naya account banao
// POST /api/auth/login   — Login karo, token milega
// POST /api/auth/logout  — Logout karo
// GET  /api/auth/me      — Apni profile dekho
// -------------------------------------------------------

const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireLogin } = require("../middlewares/auth");

const router = express.Router();

// -------------------------------------------------------
// HELPER — JWT Token banao
// -------------------------------------------------------
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "1d" } // 1 din baad expire hoga
  );
};

// -------------------------------------------------------
// POST /api/auth/signup
// -------------------------------------------------------
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Pehle check karo — kya email already registered hai?
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Yeh email already registered hai",
      });
    }

    // Naya user banao (password model mein automatically hash hoga)
    const user = await User.create({ name, email, password, phone });

    // Token banao aur cookie mein daalo
    const token = generateToken(user._id);

    res.cookie("token", token, {
      httpOnly: true,  // JavaScript se access nahi hoga — secure!
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 din milliseconds mein
      sameSite: "strict",
    });

    res.status(201).json({
      success: true,
      message: "Account ban gaya! Welcome 🎉",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Kuch gadbad ho gayi",
      error: error.message,
    });
  }
});

// -------------------------------------------------------
// POST /api/auth/login
// -------------------------------------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // User dhundo — password bhi chahiye isliye +password
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Email ya password galat hai",
      });
    }

    // Password check karo
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Email ya password galat hai",
      });
    }

    // Token banao
    const token = generateToken(user._id);

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "strict",
    });

    res.json({
      success: true,
      message: `Welcome back, ${user.name}! 👋`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Kuch gadbad ho gayi",
      error: error.message,
    });
  }
});

// -------------------------------------------------------
// POST /api/auth/logout
// -------------------------------------------------------
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({
    success: true,
    message: "Logout ho gaye. Phir milenge! 👋",
  });
});

// -------------------------------------------------------
// GET /api/auth/me — Apni profile dekho
// -------------------------------------------------------
router.get("/me", requireLogin, async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

module.exports = router;