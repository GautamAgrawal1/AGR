// models/MenuItem.js
// -------------------------------------------------------
// YEH MODEL KYA HAI:
// Restaurant ke menu items — jaise "Paneer Butter Masala",
// "Veg Biryani", "Mango Lassi" etc.
//
// SEEKHNE WALI CHEEZ — Schema aur Types:
// String, Number, Boolean, Array — yeh sab MongoDB ke
// data types hain. Mongoose inhe validate karta hai.
// -------------------------------------------------------

const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Item ka naam dena zaroori hai"],
      trim: true, // Extra spaces remove ho jaate hain automatically
    },

    description: {
      type: String,
      trim: true,
    },

    price: {
      type: Number,
      required: [true, "Mandatory field"],
      min: [0, "Negative value is not acceptable"],
    },

    category: {
      type: String,
      required: true,
      // enum = sirf yeh values allowed hain
      enum: ["Starter", "Main Course", "Dessert", "Beverage", "Breakfast"],
    },

    isVeg: {
      type: Boolean,
      default: true, // Default vegetarian
    },

    isAvailable: {
      type: Boolean,
      default: true, // Available by default, staff band kar sakta hai
    },

    image: {
      type: String, // Image ka URL ya file path
      default: "",
    },

    preparationTime: {
      type: Number, // Minutes mein
      default: 15,
    },

    spiceLevel: {
      type: String,
      enum: ["Mild", "Medium", "Spicy", "Extra Spicy"],
      default: "Medium",
    },
  },
  {
    timestamps: true, // createdAt aur updatedAt automatically add ho jaata hai
  }
);

module.exports = mongoose.model("MenuItem", menuItemSchema);