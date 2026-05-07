// models/HotelSettings.js
// Hotel photos aur global settings MongoDB mein store karo
// Render pe filesystem ephemeral hai — yahi sahi jagah hai

const mongoose = require("mongoose");

const hotelSettingsSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true, default: "main" },
  photos:    [{ url: String, publicId: String }],
}, { timestamps: true });

module.exports = mongoose.model("HotelSettings", hotelSettingsSchema);
