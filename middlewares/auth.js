// middlewares/auth.js
// -------------------------------------------------------
// TEEN FUNCTIONS:
//
// 1. setUser     — Token se user identify karo (optional login)
// 2. requireLogin — Login hona zaroori hai
// 3. requireRole  — Specific role chahiye (ADMIN, STAFF, etc.)
//
// SEEKHNE WALI CHEEZ — Middleware kya hota hai:
// Middleware ek function hai jo request aur response ke
// BEECH mein run hota hai. Route handler se PEHLE chalta hai.
// next() call karo toh aage badhta hai, nahi kiya toh rok deta hai.
// -------------------------------------------------------

const jwt = require("jsonwebtoken");
const User = require("../models/User");

// -------------------------------------------------------
// 1. SET USER — Har request pe run karo
//    Token hai toh user set karo, nahi hai toh chalte raho
// -------------------------------------------------------
const setUser = async (req, res, next) => {
  try {
    // Token cookie mein ya Authorization header mein ho sakta hai
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      req.user = null;
      return next(); // Token nahi hai — guest user, aage badhao
    }

    // Token verify karo
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // User database se fetch karo (password nahi chahiye isliye -password)
    const user = await User.findById(decoded.id).select("-password");

    req.user = user; // Request object mein user attach karo
    next();
  } catch (error) {
    // Token invalid ya expired hai
    req.user = null;
    next();
  }
};

// -------------------------------------------------------
// 2. REQUIRE LOGIN — Yeh route sirf logged in users ke liye
// -------------------------------------------------------
const requireLogin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Pehle login karo",
    });
  }
  next();
};

// -------------------------------------------------------
// 3. REQUIRE ROLE — Specific role chahiye
//    Usage: requireRole("ADMIN") ya requireRole("ADMIN", "STAFF")
// -------------------------------------------------------
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Pehle login karo",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Yeh kaam sirf ${roles.join(" ya ")} kar sakta hai`,
      });
    }

    next();
  };
};

module.exports = { setUser, requireLogin, requireRole };