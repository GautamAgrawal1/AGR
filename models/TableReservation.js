// models/TableReservation.js
// -------------------------------------------------------
// YEH MODEL KYA HAI:
// Restaurant mein table advance mein book karna.
// Jaise family dinner ke liye "6 baje, 4 log, table chahiye".
//
// SEEKHNE WALI CHEEZ — Date handling:
// Date type mein MongoDB automatically date store karta hai.
// Hum check karenge ki same table same time pe double book
// na ho — isko "conflict check" kehte hain.
// -------------------------------------------------------

const mongoose = require("mongoose");

const tableReservationSchema = new mongoose.Schema(
  {
    // Kisne book kiya
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Guestka naam (walk-in ke liye bhi kaam aata hai)
    guestName: {
      type: String,
      required: [true, "Naam dena zaroori hai"],
      trim: true,
    },

    guestPhone: {
      type: String,
      required: [true, "Phone number dena zaroori hai"],
    },

    // Kitne log aayenge
    numberOfGuests: {
      type: Number,
      required: true,
      min: [1, "Kam se kam 1 guest toh hoga"],
      max: [20, "Ek table pe 20 se zyada log nahi"],
    },

    // Kab aayenge
    reservationDate: {
      type: Date,
      required: [true, "Date batao"],
    },

    // Kis waqt — "7:00 PM", "1:30 PM" etc.
    reservationTime: {
      type: String,
      required: [true, "Time batao"],
    },

    // Kaunsi table (1 se 20 tak maano)
    tableNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
    },

    // Reservation ka status
    status: {
      type: String,
      enum: [
        "Pending",   // Confirm nahi hua
        "Confirmed", // Admin ne confirm kiya
        "Seated",    // Guest aa gaya aur baith gaya
        "Completed", // Khaana ho gaya
        "Cancelled", // Cancel ho gaya
        "No-Show",   // Aaya hi nahi
      ],
      default: "Pending",
    },

    // Special request — jaise "birthday cake chahiye", "window seat"
    specialRequest: {
      type: String,
      default: "",
    },

    // Occasion
    occasion: {
      type: String,
      enum: ["None", "Birthday", "Anniversary", "Business Dinner", "Other"],
      default: "None",
    },
  },
  {
    timestamps: true,
  }
);

// -------------------------------------------------------
// INDEX — Database searches fast hoti hain
// Hum date aur tableNumber pe index banate hain kyunki
// hum inhe conflict check mein use karenge
// -------------------------------------------------------
tableReservationSchema.index({ reservationDate: 1, tableNumber: 1 });

// -------------------------------------------------------
// STATIC METHOD — Model pe directly call kar sakte hain
// Check karo ki koi table already booked hai ya nahi
// -------------------------------------------------------
tableReservationSchema.statics.isTableAvailable = async function (
  tableNumber,
  date,
  time,
  excludeId = null // Update ke waqt apni hi booking ko exclude karo
) {
  const query = {
    tableNumber,
    reservationDate: date,
    reservationTime: time,
    status: { $in: ["Pending", "Confirmed", "Seated"] }, // Active bookings
  };

  if (excludeId) {
    query._id = { $ne: excludeId }; // Apni booking ko count mat karo
  }

  const existing = await this.findOne(query);
  return !existing; // True = available, False = booked
};

module.exports = mongoose.model("TableReservation", tableReservationSchema);