// models/Room.js
// -------------------------------------------------------
// AGR HOTEL — Real Room Structure
//
// ROOM TYPES:
// 1. Deluxe AC    — Room 215-227 (14 rooms)
// 2. Non-AC       — Room 101-110 (7 rooms)
// 3. Suite        — Room 221 (Maharaja Room)
// 4. Dormitory    — Per bed booking
// -------------------------------------------------------

const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: [true, "Room number dena zaroori hai"],
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Deluxe AC Double", "Maharaja Suite", "Dormitory Bed"
    },

    type: {
      type: String,
      required: true,
      enum: ["Deluxe AC", "Non-AC", "Suite", "Dormitory"],
    },

    bedType: {
      type: String,
      required: true,
      enum: ["Single", "Double", "Triple", "Bed"], // Bed = dormitory ke liye
    },

    description: {
      type: String,
      default: "",
    },

    // Kitne log reh sakte hain
    capacity: {
      type: Number,
      required: true,
    },

    floor: {
      type: Number,
      required: true,
    },

    // -------------------------------------------------------
    // PRICING — Original + Offer dono store karo
    // -------------------------------------------------------
    pricing: {
      originalPrice: { type: Number, required: true },
      offerPrice:    { type: Number, required: true },
    },

    // -------------------------------------------------------
    // AMENITIES
    // -------------------------------------------------------
    amenities: {
      hasAC:          { type: Boolean, default: false },
      hasWifi:        { type: Boolean, default: true  }, // Sab rooms mein
      hasPowerBackup: { type: Boolean, default: true  }, // 24x7 sab mein
      hasRoomService: { type: Boolean, default: true  }, // Sab mein
      has24x7AC:      { type: Boolean, default: false }, // Sirf Deluxe mein
    },

    images:     { type: [String], default: [] },
    coverImage: { type: String,   default: "" },

    isAvailable: { type: Boolean, default: true },

    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

// -------------------------------------------------------
// INDEX
// -------------------------------------------------------
roomSchema.index({ type: 1, "pricing.offerPrice": 1 });
roomSchema.index({ isAvailable: 1 });

// -------------------------------------------------------
// STATIC METHOD — Available rooms dhundo given date range
// -------------------------------------------------------
roomSchema.statics.findAvailableRooms = async function (checkIn, checkOut, type = null) {
  const Booking = require("./Booking");

  const bookedRoomIds = await Booking.find({
    status: { $in: ["Confirmed", "CheckedIn"] },
    checkIn:  { $lt: checkOut },
    checkOut: { $gt: checkIn },
  }).distinct("room");

  const filter = {
    _id:         { $nin: bookedRoomIds },
    isAvailable: true,
  };

  if (type) filter.type = type;

  return this.find(filter).sort({ "pricing.offerPrice": 1 });
};

module.exports = mongoose.model("Room", roomSchema);