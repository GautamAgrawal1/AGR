// models/Review.js
// -------------------------------------------------------
// YEH MODEL KYA HAI:
// Guest room ka review deta hai — rating + comment.
//
// SEEKHNE WALI CHEEZ — Post Save/Delete Hook:
// Jab bhi koi review add ya delete hota hai, Room ka
// averageRating automatically recalculate hota hai.
// Isse "Mongoose Middleware" ya "Hooks" kehte hain.
// -------------------------------------------------------

const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    // Kisne review diya
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Kaunse room ka review
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },

    // Booking reference — sirf jo ruka ho woh review de sake
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    // Rating 1 se 5
    rating: {
      type: Number,
      required: [true, "Rating dena zaroori hai"],
      min: [1, "Rating kam se kam 1 honi chahiye"],
      max: [5, "Rating zyada se zyada 5 ho sakti hai"],
    },

    // Review text
    comment: {
      type: String,
      required: [true, "Review likhna zaroori hai"],
      trim: true,
      minlength: [10, "Review thoda lamba likho — kam se kam 10 characters"],
      maxlength: [500, "Review zyada se zyada 500 characters ka ho sakta hai"],
    },

    // Sub-ratings — detailed feedback
    subRatings: {
      cleanliness: { type: Number, min: 1, max: 5, default: null },
      service:     { type: Number, min: 1, max: 5, default: null },
      comfort:     { type: Number, min: 1, max: 5, default: null },
      value:       { type: Number, min: 1, max: 5, default: null },
    },

    // Admin ka reply
    adminReply: {
      text:      { type: String, default: "" },
      repliedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// -------------------------------------------------------
// UNIQUE INDEX — Ek guest ek booking ka sirf ek review de sake
// -------------------------------------------------------
reviewSchema.index({ guest: 1, booking: 1 }, { unique: true });

// -------------------------------------------------------
// STATIC METHOD — Room ka average rating recalculate karo
// Yeh method hum hooks mein call karenge
// -------------------------------------------------------
reviewSchema.statics.recalculateRating = async function (roomId) {
  // Aggregate — is room ke saare reviews ka average nikalo
  const result = await this.aggregate([
    { $match: { room: roomId } },
    {
      $group: {
        _id: "$room",
        averageRating: { $avg: "$rating" }, // Average calculate karo
        totalReviews:  { $sum: 1 },          // Count karo
      },
    },
  ]);

  // Room model update karo
  const Room = require("./Room");

  if (result.length > 0) {
    await Room.findByIdAndUpdate(roomId, {
      averageRating: Math.round(result[0].averageRating * 10) / 10, // 1 decimal place
      totalReviews:  result[0].totalReviews,
    });
  } else {
    // Koi review nahi — reset karo
    await Room.findByIdAndUpdate(roomId, {
      averageRating: 0,
      totalReviews:  0,
    });
  }
};

// -------------------------------------------------------
// POST SAVE HOOK — Review save hone ke baad rating update
// -------------------------------------------------------
reviewSchema.post("save", async function () {
  // this.constructor = Review model
  await this.constructor.recalculateRating(this.room);
});

// -------------------------------------------------------
// POST DELETE HOOK — Review delete hone ke baad bhi update
// -------------------------------------------------------
reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await doc.constructor.recalculateRating(doc.room);
  }
});

module.exports = mongoose.model("Review", reviewSchema);