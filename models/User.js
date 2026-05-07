// models/User.js
// -------------------------------------------------------
// TEEN ROLES:
// GUEST   — Normal customer jo book karta hai
// STAFF   — Hotel employee jo orders handle karta hai
// ADMIN   — Poora access, sab manage kar sakta hai
// -------------------------------------------------------

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Naam dena zaroori hai"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email dena zaroori hai"],
      unique: true, // Ek email se ek hi account
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: [true, "Password dena zaroori hai"],
      minlength: [6, "Password kam se kam 6 characters ka hona chahiye"],
      select: false, // By default password fetch nahi hoga — security!
    },

    phone: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      enum: ["GUEST", "STAFF", "ADMIN"],
      default: "GUEST",
    },
  },
  {
    timestamps: true,
  }
);

// -------------------------------------------------------
// PASSWORD HASHING — Save karne se pehle automatically
// Plain text password kabhi save mat karo database mein!
// -------------------------------------------------------
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
  });
// -------------------------------------------------------
// METHOD — Password verify karne ke liye
// Login ke waqt use karenge
// -------------------------------------------------------
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);