// models/OwnerProfile.js
// Owner photos aur info MongoDB mein store karo

const mongoose = require("mongoose");

const ownerProfileSchema = new mongoose.Schema({
  index:    { type: Number, required: true, unique: true }, // 1, 2, 3
  name:     { type: String, default: "" },
  role:     { type: String, default: "" },
  photo:    { type: String, default: "" },
  publicId: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("OwnerProfile", ownerProfileSchema);
