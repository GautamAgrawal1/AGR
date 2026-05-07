// models/Order.js
// -------------------------------------------------------
// YEH MODEL KYA HAI:
// Jab koi guest restaurant mein khana order karta hai,
// toh woh order yahan save hota hai.
//
// SEEKHNE WALI CHEEZ — Nested Objects aur ref:
// "items" ek array hai jisme har element ek object hai.
// "ref: 'MenuItem'" matlab yeh field MenuItem model se
// linked hai — isse "Population" kehte hain Mongoose mein.
// -------------------------------------------------------

const mongoose = require("mongoose");

// Har ordered item ka structure
const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId, // MongoDB ID
    ref: "MenuItem", // MenuItem model se link
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true, // Order ke waqt ka price save karo (baad mein price change ho sakta hai)
  },
  specialInstructions: {
    type: String,
    default: "", // Jaise "No onion", "Extra spicy"
  },
});

const orderSchema = new mongoose.Schema(
  {
    // Kisne order kiya
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Kaunse items order kiye
    items: [orderItemSchema], // Array of orderItemSchema

    // Order kahan ka hai
    orderType: {
      type: String,
      enum: ["Dine-In", "Room Service"],
      required: true,
    },

    // Agar Dine-In hai toh kaunsi table
    tableNumber: {
      type: Number,
      default: null,
    },

    // Agar Room Service hai toh kaunsa room
    roomNumber: {
      type: String,
      default: null,
    },

    // Order ka total amount
    totalAmount: {
      type: Number,
      required: true,
    },

    // Order abhi kahan hai — lifecycle track karta hai
    status: {
      type: String,
      enum: [
        "Pending",    // Order aaya, kitchen ne nahi dekha
        "Confirmed",  // Kitchen ne accept kiya
        "Preparing",  // Ban raha hai
        "Ready",      // Ban gaya, delivery ke liye ready
        "Delivered",  // Guest ko mil gaya
        "Cancelled",  // Cancel ho gaya
      ],
      default: "Pending",
    },

    // Payment status
    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Paid"],
      default: "Unpaid",
    },

    // Special note for entire order
    specialNote: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// -------------------------------------------------------
// VIRTUAL FIELD — Database mein save nahi hota
// Lekin jab bhi order fetch karo, yeh calculate ho jaata hai
// -------------------------------------------------------
orderSchema.virtual("itemCount").get(function () {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

module.exports = mongoose.model("Order", orderSchema);