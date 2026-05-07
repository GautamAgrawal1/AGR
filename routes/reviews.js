// routes/reviews.js
// -------------------------------------------------------
// ROUTES:
// POST   /api/reviews              — Review do (sirf checked-out guests)
// GET    /api/reviews/room/:roomId — Ek room ke saare reviews
// GET    /api/reviews/my           — Apne saare reviews
// PUT    /api/reviews/:id          — Apna review edit karo
// DELETE /api/reviews/:id          — Review delete karo
// POST   /api/reviews/:id/reply    — Admin ka reply (ADMIN only)
// -------------------------------------------------------

const express  = require("express");
const Review   = require("../models/Review");
const Booking  = require("../models/Booking");
const { requireLogin, requireRole } = require("../middlewares/auth");

const router = express.Router();

// -------------------------------------------------------
// POST /api/reviews — Naya review do
// -------------------------------------------------------
router.post("/", requireLogin, async (req, res) => {
  try {
    const { bookingId, rating, comment, subRatings } = req.body;

    // Booking exist karti hai?
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking nahi mili" });
    }

    // Sirf apni booking ka review de sako
    if (booking.guest.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Sirf apni booking ka review de sakte ho",
      });
    }

    // Sirf checked-out guests review de sakte hain
    if (booking.status !== "CheckedOut") {
      return res.status(400).json({
        success: false,
        message: "Review sirf check-out ke baad de sakte ho",
      });
    }

    // Review banao
    const review = await Review.create({
      guest:      req.user._id,
      room:       booking.room,
      booking:    bookingId,
      rating,
      comment,
      subRatings: subRatings || {},
    });

    const populatedReview = await Review.findById(review._id)
      .populate("guest", "name")
      .populate("room",  "roomNumber name");

    res.status(201).json({
      success: true,
      message: "Review de diya! Shukriya 🙏",
      review:  populatedReview,
    });
  } catch (error) {
    // Duplicate review error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Tumne is booking ka review pehle se de diya hai",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------
// GET /api/reviews/room/:roomId — Ek room ke saare reviews
// -------------------------------------------------------
router.get("/room/:roomId", async (req, res) => {
  try {
    const reviews = await Review.find({ room: req.params.roomId })
      .populate("guest", "name")
      .sort({ createdAt: -1 });

    // Summary bhi bhejo — average aur distribution
    const total = reviews.length;
    const avg   = total
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / total) * 10) / 10
      : 0;

    // Kitne 5-star, 4-star etc.
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => distribution[r.rating]++);

    res.json({
      success: true,
      summary: { averageRating: avg, totalReviews: total, distribution },
      reviews,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------
// GET /api/reviews/my — Apne saare reviews
// -------------------------------------------------------
router.get("/my", requireLogin, async (req, res) => {
  try {
    const reviews = await Review.find({ guest: req.user._id })
      .populate("room",    "roomNumber name coverImage")
      .populate("booking", "checkIn checkOut")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: reviews.length, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------
// PUT /api/reviews/:id — Apna review edit karo
// -------------------------------------------------------
router.put("/:id", requireLogin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ success: false, message: "Review nahi mila" });
    }

    // Sirf apna review edit kar sako
    if (review.guest.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Sirf apna review edit kar sakte ho",
      });
    }

    const { rating, comment, subRatings } = req.body;

    if (rating)     review.rating     = rating;
    if (comment)    review.comment    = comment;
    if (subRatings) review.subRatings = subRatings;

    await review.save(); // post-save hook chalega → averageRating update hoga

    res.json({ success: true, message: "Review update ho gaya!", review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------
// DELETE /api/reviews/:id — Review delete karo
// -------------------------------------------------------
router.delete("/:id", requireLogin, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ success: false, message: "Review nahi mila" });
    }

    // GUEST sirf apna delete kare, ADMIN koi bhi
    if (
      req.user.role === "GUEST" &&
      review.guest.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Sirf apna review delete kar sakte ho",
      });
    }

    // findOneAndDelete use karo — post hook chalega → rating update hoga
    await Review.findOneAndDelete({ _id: req.params.id });

    res.json({ success: true, message: "Review delete ho gaya!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------
// POST /api/reviews/:id/reply — Admin ka reply
// -------------------------------------------------------
router.post("/:id/reply", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    const { text } = req.body;

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      {
        adminReply: {
          text,
          repliedAt: new Date(),
        },
      },
      { new: true }
    ).populate("guest", "name");

    if (!review) {
      return res.status(404).json({ success: false, message: "Review nahi mila" });
    }

    res.json({ success: true, message: "Reply de diya!", review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;