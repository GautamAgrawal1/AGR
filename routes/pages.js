// routes/pages.js
// -------------------------------------------------------
// YEH ROUTES HTML PAGES RENDER KARTE HAIN (EJS)
// API routes se alag — yeh browser ke liye hain
// -------------------------------------------------------

const express        = require("express");
const HotelSettings  = require("../models/HotelSettings");
const OwnerProfile   = require("../models/OwnerProfile");
const Room    = require("../models/Room");
const Booking = require("../models/Booking");
const Review  = require("../models/Review");
const { requireLogin, requireRole } = require("../middlewares/auth");

const router = express.Router();

// Home / Landing Page
router.get("/", async (req, res) => {
  try {
    // Featured rooms — ek ek type ka best room
    const featuredRooms = await Room.find({ isAvailable: true })
      .sort({ averageRating: -1 })
      .limit(4);

    // Latest reviews
    const reviews = await Review.find()
      .populate("guest", "name")
      .populate("room",  "name")
      .sort({ createdAt: -1 })
      .limit(6);

    // Load owners + hotel photos from MongoDB (Railway-safe)
    const [ownerDocs, hotelDoc] = await Promise.all([
      OwnerProfile.find().sort({ index: 1 }),
      HotelSettings.findOne({ key: "main" }),
    ]);
    const owners     = [1,2,3].map(i => ownerDocs.find(o => o.index === i) || {});
    const hotelPhotos = (hotelDoc?.photos || []).map(p => p.url);

    res.render("index", {
      user:         req.user,
      featuredRooms,
      reviews,
      owners,
      hotelPhotos,
      title:        "AGR Hotel — Welcome",
    });
  } catch (error) {
    res.status(500).render("error", { user: req.user, message: error.message });
  }
});

// Rooms Page
router.get("/rooms", async (req, res) => {
  try {
    const { checkIn, checkOut, type } = req.query;

    let rooms;
    if (checkIn && checkOut) {
      rooms = await Room.findAvailableRooms(new Date(checkIn), new Date(checkOut), type);
    } else {
      const filter = { isAvailable: true };
      if (type) filter.type = type;
      rooms = await Room.find(filter).sort({ "pricing.offerPrice": 1 });
    }

    res.render("rooms", {
      user:    req.user,
      rooms,
      checkIn:  checkIn  || "",
      checkOut: checkOut || "",
      type:     type     || "",
      title:   "Rooms — AGR Hotel",
    });
  } catch (error) {
    res.status(500).render("error", { user: req.user, message: error.message });
  }
});

// Single Room Detail
router.get("/rooms/:id", async (req, res) => {
  try {
    const room    = await Room.findById(req.params.id);
    if (!room) return res.redirect("/rooms");

    const reviews = await Review.find({ room: req.params.id })
      .populate("guest", "name")
      .sort({ createdAt: -1 })
      .limit(10);

    res.render("room-detail", {
      user:    req.user,
      room,
      reviews,
      title:   `${room.name} — AGR Hotel`,
    });
  } catch (error) {
    res.status(500).render("error", { user: req.user, message: error.message });
  }
});

// Restaurant Page
router.get("/restaurant", async (req, res) => {
  try {
    const MenuItem = require("../models/MenuItem");
    const menu = await MenuItem.find({ isAvailable: true }).sort({ category: 1 });

    // Category wise group karo
    const menuByCategory = menu.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

    res.render("restaurant", {
      user:           req.user,
      menuByCategory,
      title:          "Restaurant — AGR Hotel",
    });
  } catch (error) {
    res.status(500).render("error", { user: req.user, message: error.message });
  }
});

// Login Page
router.get("/login", (req, res) => {
  if (req.user) return res.redirect("/dashboard");
  res.render("login", { user: null, title: "Login — AGR Hotel", error: null });
});

// Signup Page
router.get("/signup", (req, res) => {
  if (req.user) return res.redirect("/dashboard");
  res.render("signup", { user: null, title: "Signup — AGR Hotel", error: null });
});

// POST /rooms/book-now — Booking banao + Razorpay order return karo (JSON)
// Frontend seedha payment window kholega — koi redirect nahi
router.post("/rooms/book-now", requireLogin, async (req, res) => {
  try {
    const { roomId, checkIn, checkOut, guests, adults, specialRequests } = req.body;
    const guestsData = guests || { adults: parseInt(adults) || 1, children: 0 };

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: "Room nahi mila" });
    if (!room.isAvailable) return res.status(400).json({ success: false, message: "Room available nahi hai" });

    const checkInDate  = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate) || isNaN(checkOutDate) || checkInDate >= checkOutDate) {
      return res.status(400).json({ success: false, message: "Invalid check-in / check-out dates" });
    }

    const nights      = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const totalAmount = room.pricing.offerPrice * nights;

    // Booking create karo
    const booking = await Booking.create({
      guest:           req.user._id,
      room:            roomId,
      checkIn:         checkInDate,
      checkOut:        checkOutDate,
      guests:          guestsData,
      totalAmount,
      specialRequests: specialRequests || "",
    });

    // Razorpay order bhi create karo — frontend directly payment window kholega
    const { createOrder } = require("../services/payment");
    const razorpayOrder = await createOrder(totalAmount, "INR", `booking_${booking._id}`);

    // Razorpay order ID booking mein save karo
    booking.payment = { razorpayOrderId: razorpayOrder.id };
    await booking.save();

    // Frontend ko saari details ek saath do
    res.json({
      success: true,
      booking: {
        id:          booking._id,
        totalAmount: booking.totalAmount,
        checkIn:     checkInDate,
        checkOut:    checkOutDate,
        nights,
      },
      order: {
        id:       razorpayOrder.id,
        amount:   razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
      keyId: process.env.RAZORPAY_KEY_ID,
    });

  } catch (error) {
    console.error("book-now error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Guest Dashboard
router.get("/dashboard", requireLogin, async (req, res) => {
  try {
    const bookings = await Booking.find({ guest: req.user._id })
      .populate("room", "roomNumber name type coverImage pricing")
      .sort({ createdAt: -1 });

    res.render("dashboard", {
      user:      req.user,
      bookings,
      booked:    req.query.booked === "true",
      bookingId: req.query.bookingId || null,
      title:     "My Dashboard — AGR Hotel",
    });
  } catch (error) {
    res.status(500).render("error", { user: req.user, message: error.message });
  }
});

// Admin Panel
router.get("/admin", requireLogin, requireRole("ADMIN"), async (req, res) => {
  res.render("admin/index", { user: req.user, title: "Admin Panel — AGR Hotel" });
});

// Auth actions (form submissions)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const User = require("../models/User");
    const jwt  = require("jsonwebtoken");

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.render("login", {
        user:  null,
        title: "Login — AGR Hotel",
        error: "Email ya password galat hai",
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect("/dashboard");
  } catch (error) {
    res.render("login", { user: null, title: "Login", error: "Kuch gadbad ho gayi" });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const User = require("../models/User");
    const jwt  = require("jsonwebtoken");

    const existing = await User.findOne({ email });
    if (existing) {
      return res.render("signup", {
        user:  null,
        title: "Signup — AGR Hotel",
        error: "Yeh email already registered hai",
      });
    }

    const user  = await User.create({ name, email, password, phone });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect("/dashboard");
  } catch (error) {
    res.render("signup", { user: null, title: "Signup", error: error.message });
  }
});

router.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});

// ============================================================
// CLOUDINARY UPLOAD ROUTES
// ============================================================
const multer = require("multer");
const memStorage = multer.memoryStorage(); // Memory mein rakho — Cloudinary pe bhejo

// POST /admin/upload-hotel — Hotel photos (Cloudinary)
router.post("/admin/upload-hotel", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    const { uploadToCloudinary } = require("../services/cloudinary");
    const upload = multer({ storage: memStorage }).single("photo");

    upload(req, res, async (err) => {
      if (err) return res.json({ success: false, message: err.message });
      if (!req.file) return res.json({ success: false, message: "Photo select karo" });

      const result = await uploadToCloudinary(req.file.buffer, "agr-hotel/hotel");

      // MongoDB mein save karo (Railway-safe)
      const doc = await HotelSettings.findOneAndUpdate(
        { key: "main" },
        { $push: { photos: { url: result.secure_url, publicId: result.public_id } } },
        { new: true, upsert: true }
      );
      const photos = doc.photos.map(p => p.url);
      res.json({ success: true, message: "Hotel photo upload ho gayi!", photos });
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// POST /admin/delete-hotel-photo — Delete hotel photo
router.post("/admin/delete-hotel-photo", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    const { deleteFromCloudinary } = require("../services/cloudinary");
    const { photoUrl } = req.body;

    const doc = await HotelSettings.findOne({ key: "main" });
    if (doc) {
      const photo = doc.photos.find(p => p.url === photoUrl);
      if (photo?.publicId) await deleteFromCloudinary(photo.publicId).catch(()=>{});
      await HotelSettings.updateOne({ key: "main" }, { $pull: { photos: { url: photoUrl } } });
    }
    const updated = await HotelSettings.findOne({ key: "main" });
    res.json({ success: true, message: "Photo delete ho gayi!", photos: (updated?.photos||[]).map(p=>p.url) });
  } catch(error) {
    res.json({ success: false, message: error.message });
  }
});

// POST /admin/upload-owner — Owner photos (Cloudinary)
router.post("/admin/upload-owner", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    const { uploadToCloudinary, deleteFromCloudinary } = require("../services/cloudinary");
    const upload = multer({ storage: memStorage }).single("photo");

    upload(req, res, async (err) => {
      if (err) return res.json({ success: false, message: err.message });

      const ownerIdx = parseInt(req.body.ownerIndex);
      const update = {};
      if (req.body.name) update.name = req.body.name;
      if (req.body.role) update.role = req.body.role;

      if (req.file) {
        const existing = await OwnerProfile.findOne({ index: ownerIdx });
        if (existing?.publicId) await deleteFromCloudinary(existing.publicId).catch(()=>{});
        const result = await uploadToCloudinary(req.file.buffer, "agr-hotel/owners");
        update.photo    = result.secure_url;
        update.publicId = result.public_id;
      }

      await OwnerProfile.findOneAndUpdate(
        { index: ownerIdx },
        { $set: update },
        { upsert: true, new: true }
      );
      res.json({ success: true, message: `Owner ${req.body.ownerIndex} update ho gaya!` });
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// POST /admin/delete-owner-photo
router.post("/admin/delete-owner-photo", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    const { deleteFromCloudinary } = require("../services/cloudinary");
    const ownerIdx = parseInt(req.body.ownerIndex);
    const owner = await OwnerProfile.findOne({ index: ownerIdx });
    if (owner?.publicId) await deleteFromCloudinary(owner.publicId).catch(()=>{});
    await OwnerProfile.findOneAndUpdate({ index: ownerIdx }, { $set: { photo: "", publicId: "" } });
    res.json({ success: true, message: `Owner ${req.body.ownerIndex} ki photo delete ho gayi!` });
  } catch(error) {
    res.json({ success: false, message: error.message });
  }
});

// POST /admin/upload-room-multi — Room photos (Cloudinary)
router.post("/admin/upload-room-multi", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    const { uploadToCloudinary } = require("../services/cloudinary");
    const Room   = require("../models/Room");
    const upload = multer({ storage: memStorage }).array("photos", 10);

    upload(req, res, async (err) => {
      if (err) return res.json({ success: false, message: err.message });
      if (!req.files || !req.files.length) return res.json({ success: false, message: "Photos select karo" });

      const uploads = await Promise.all(
        req.files.map(f => uploadToCloudinary(f.buffer, "agr-hotel/rooms"))
      );
      const urls = uploads.map(u => u.secure_url);

      const room = await Room.findOneAndUpdate(
        { roomNumber: req.body.roomNumber },
        {
          $push: { images: { $each: urls } },
          $set:  { coverImage: urls[0] },
        },
        { new: true }
      );

      if (!room) return res.json({ success: false, message: "Room nahi mila" });
      res.json({ success: true, message: `${req.files.length} photos upload ho gayi!`, room });
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// GET /api/hotel-photos
router.get("/api/hotel-photos", async (req, res) => {
  try {
    const doc    = await HotelSettings.findOne({ key: "main" });
    const photos = (doc?.photos || []).map(p => p.url);
    res.json({ success: true, photos });
  } catch(e) {
    res.json({ success: true, photos: [] });
  }
});
// POST /admin/delete-room-photo — Room ki specific photo delete karo
router.post("/admin/delete-room-photo", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    const { deleteFromCloudinary } = require("../services/cloudinary");
    const Room = require("../models/Room");
    const { roomId, photoUrl } = req.body;

    const room = await Room.findById(roomId);
    if (!room) return res.json({ success: false, message: "Room nahi mila" });

    // Remove from images array
    room.images = (room.images || []).filter(p => p !== photoUrl);

    // Update cover image if deleted
    if (room.coverImage === photoUrl) {
      room.coverImage = room.images[0] || null;
    }

    await room.save();

    // Delete from Cloudinary
    try {
      const parts    = photoUrl.split("/");
      const filename = parts[parts.length - 1].split(".")[0];
      const folder   = parts[parts.length - 2];
      await deleteFromCloudinary(`${folder}/${filename}`);
    } catch(e) {}

    res.json({ success: true, message: "Photo delete ho gayi!", room });
  } catch(error) {
    res.json({ success: false, message: error.message });
  }
});
module.exports = router;