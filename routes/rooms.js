// routes/rooms.js
// -------------------------------------------------------
// ROOM ROUTES:
// GET    /api/rooms                        — Rooms browse karo (filters available)
// GET    /api/rooms/:id                    — Ek room ka detail
// POST   /api/rooms                        — Naya room add (ADMIN)
// PUT    /api/rooms/:id                    — Room update (ADMIN)
// DELETE /api/rooms/:id                    — Room delete (ADMIN)
//
// BOOKING ROUTES:
// POST   /api/rooms/book                   — Room book karo
// GET    /api/rooms/my-bookings            — Apni bookings
// GET    /api/rooms/bookings/:id           — Ek booking ka detail
// POST   /api/rooms/bookings/:id/cancel    — Cancel karo
// PATCH  /api/rooms/bookings/:id/status    — Status update (ADMIN)
// -------------------------------------------------------

const express = require("express");
const Room    = require("../models/Room");
const Booking = require("../models/Booking");
const { requireLogin, requireRole } = require("../middlewares/auth");

const router = express.Router();

// ==============================================================
// IMPORTANT: Static routes pehle likhte hain — /my-bookings
// warna Express sochega "my-bookings" ek :id hai
// ==============================================================

// GET /api/rooms/my-bookings — Apni bookings dekho
router.get("/my-bookings", requireLogin, async (req, res) => {
  try {
    let query = {};

    // GUEST sirf apni, ADMIN/STAFF sab dekh sakte hain
    if (req.user.role === "GUEST") {
      query.guest = req.user._id;
    }

    const bookings = await Booking.find(query)
      .populate("room", "roomNumber name type bedType pricing coverImage")
      .populate("guest", "name email phone")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: bookings.length, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================
// ROOM ROUTES
// ==============================================================

// GET /api/rooms — Saare rooms browse karo
// Query: ?checkIn=2024-12-01&checkOut=2024-12-03&type=Deluxe AC
router.get("/", async (req, res) => {
  try {
    const { checkIn, checkOut, type } = req.query;

    let rooms;

    if (checkIn && checkOut) {
      const checkInDate  = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      // Validation
      if (checkInDate >= checkOutDate) {
        return res.status(400).json({
          success: false,
          message: "Check-out date, check-in se baad honi chahiye",
        });
      }

      if (checkInDate < new Date(new Date().setHours(0, 0, 0, 0))) {
        return res.status(400).json({
          success: false,
          message: "Check-in date past mein nahi ho sakti",
        });
      }

      rooms = await Room.findAvailableRooms(checkInDate, checkOutDate, type);
    } else {
      // Dates nahi diye — sab rooms dikhaao
      const filter = { isAvailable: true };
      if (type) filter.type = type;
      rooms = await Room.find(filter).sort({ "pricing.offerPrice": 1 });
    }

    res.json({ success: true, count: rooms.length, rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/rooms/:id — Ek room ka full detail
router.get("/:id", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ success: false, message: "Room nahi mila" });
    }

    res.json({ success: true, room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/rooms — Naya room add karo (ADMIN only)
router.post("/", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    const room = await Room.create(req.body);
    res.status(201).json({ success: true, message: "Room add ho gaya! 🏨", room });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/rooms/:id — Room update karo (ADMIN only)
router.put("/:id", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!room) {
      return res.status(404).json({ success: false, message: "Room nahi mila" });
    }

    res.json({ success: true, message: "Room update ho gaya!", room });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/rooms/:id — Room delete karo (ADMIN only)
router.delete("/:id", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);

    if (!room) {
      return res.status(404).json({ success: false, message: "Room nahi mila" });
    }

    res.json({ success: true, message: "Room delete ho gaya!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================
// BOOKING ROUTES
// ==============================================================

// POST /api/rooms/book — Room book karo
router.post("/book", requireLogin, async (req, res) => {
  try {
    const { roomId, checkIn, checkOut, guests, specialRequests } = req.body;

    // Room exist karta hai?
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: "Room nahi mila" });
    }

    if (!room.isAvailable) {
      return res.status(400).json({ success: false, message: "Yeh room available nahi hai" });
    }

    // Dates validate karo
    const checkInDate  = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (checkInDate >= checkOutDate) {
      return res.status(400).json({
        success: false,
        message: "Check-out date, check-in se baad honi chahiye",
      });
    }

    // Total nights aur amount calculate karo
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const totalAmount = room.pricing.offerPrice * nights;

    // Booking create karo (pre-save hook conflict check karega)
    const booking = await Booking.create({
      guest: req.user._id,
      room:  roomId,
      checkIn:  checkInDate,
      checkOut: checkOutDate,
      guests:   guests || { adults: 1, children: 0 },
      totalAmount,
      specialRequests: specialRequests || "",
    });

    // Populated booking return karo
    const populatedBooking = await Booking.findById(booking._id)
      .populate("room", "roomNumber name type bedType pricing amenities")
      .populate("guest", "name email phone");

    res.status(201).json({
      success: true,
      message: `Room ${room.roomNumber} book ho gaya! ${nights} raaton ke liye ₹${totalAmount} 🎉`,
      booking: populatedBooking,
    });
  } catch (error) {
    // Date conflict error handle karo
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/rooms/bookings/:id — Ek booking ka detail
router.get("/bookings/:id", requireLogin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("room",  "roomNumber name type bedType pricing amenities coverImage")
      .populate("guest", "name email phone");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking nahi mili" });
    }

    // GUEST sirf apni booking dekhe
    if (
      req.user.role === "GUEST" &&
      booking.guest._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: "Yeh tumhari booking nahi hai" });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/rooms/bookings/:id/cancel — Booking cancel karo
router.post("/bookings/:id/cancel", requireLogin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking nahi mili" });
    }

    // GUEST sirf apni booking cancel kar sakta hai
    if (
      req.user.role === "GUEST" &&
      booking.guest.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: "Yeh tumhari booking nahi hai" });
    }

    // Already cancelled ya checked out booking cancel nahi ho sakti
    if (["Cancelled", "CheckedOut"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Booking already ${booking.status} hai — cancel nahi ho sakti`,
      });
    }

    booking.status = "Cancelled";
    await booking.save();

    res.json({ success: true, message: "Booking cancel ho gayi.", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/rooms/bookings/:id/status — Status update (ADMIN/STAFF)
router.patch(
  "/bookings/:id/status",
  requireLogin,
  requireRole("ADMIN", "STAFF"),
  async (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = ["Pending", "Confirmed", "CheckedIn", "CheckedOut", "Cancelled"];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Valid statuses: ${validStatuses.join(", ")}`,
        });
      }

      const booking = await Booking.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      ).populate("room", "roomNumber name");

      if (!booking) {
        return res.status(404).json({ success: false, message: "Booking nahi mili" });
      }

      res.json({
        success: true,
        message: `Booking status: ${status}`,
        booking,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

module.exports = router;