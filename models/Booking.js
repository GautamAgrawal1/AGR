// models/Booking.js
const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    guest: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    room:  { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },

    checkIn:  { type: Date, required: [true, "Check-in date dena zaroori hai"] },
    checkOut: { type: Date, required: [true, "Check-out date dena zaroori hai"] },

    guests: {
      adults:   { type: Number, required: true, min: 1 },
      children: { type: Number, default: 0 },
    },

    totalAmount: { type: Number, required: true },

    payment: {
      razorpayOrderId:   { type: String, default: "" },
      razorpayPaymentId: { type: String, default: "" },
      status: {
        type: String,
        enum: ["Pending", "Paid", "Refunded", "Failed"],
        default: "Pending",
      },
    },

    status: {
      type: String,
      enum: ["Pending", "Confirmed", "CheckedIn", "CheckedOut", "Cancelled"],
      default: "Pending",
    },

    specialRequests: { type: String, default: "" },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual — kitne raate ruke
bookingSchema.virtual("totalNights").get(function () {
  return Math.ceil((this.checkOut - this.checkIn) / (1000 * 60 * 60 * 24));
});

// Pre-save — date conflict check
bookingSchema.pre("save", async function () {
  if (!this.isNew && !this.isModified("checkIn") && !this.isModified("checkOut")) return;

  const conflict = await mongoose.model("Booking").findOne({
    _id:      { $ne: this._id },
    room:     this.room,
    status:   { $in: ["Confirmed", "CheckedIn"] },
    checkIn:  { $lt: this.checkOut },
    checkOut: { $gt: this.checkIn },
  });

  if (conflict) {
    const err = new Error("Yeh room in dates pe already booked hai. Doosri dates try karo.");
    err.statusCode = 400;
    throw err;
  }
});

bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ guest: 1, status: 1 });

module.exports = mongoose.model("Booking", bookingSchema);