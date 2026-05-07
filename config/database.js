// config/database.js
// -------------------------------------------------------
// YEH FILE KYA KARTI HAI:
// MongoDB Atlas se connection establish karti hai.
// Ek baar connect hone ke baad mongoose poori app mein
// available rehta hai — baar baar connect nahi karna padta.
// -------------------------------------------------------

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1); // App band kar do agar DB connect na ho
  }
};

module.exports = connectDB;