// routes/admin.js
// -------------------------------------------------------
// ADMIN ROUTES — Sirf ADMIN role ke liye
//
// DASHBOARD:
// GET  /api/admin/dashboard          — Overall stats
// GET  /api/admin/revenue            — Revenue breakdown
// GET  /api/admin/occupancy          — Room occupancy
//
// USERS:
// GET  /api/admin/users              — Saare users
// GET  /api/admin/users/:id          — Ek user detail
// PATCH /api/admin/users/:id/role    — Role change karo
// DELETE /api/admin/users/:id        — User delete karo
//
// BOOKINGS:
// GET  /api/admin/bookings           — Saari bookings
// GET  /api/admin/bookings/today     — Aaj ke check-ins/outs
//
// ORDERS:
// GET  /api/admin/orders             — Saare orders
// GET  /api/admin/orders/pending     — Pending orders
//
// ROOMS:
// PATCH /api/admin/rooms/:id/toggle  — Room available/unavailable toggle
// -------------------------------------------------------

const express  = require("express");
const mongoose = require("mongoose");
const User     = require("../models/User");
const Room     = require("../models/Room");
const Booking  = require("../models/Booking");
const Order    = require("../models/Order");
const Review   = require("../models/Review");
const { requireLogin, requireRole } = require("../middlewares/auth");

const router = express.Router();

// Saare admin routes pe yeh middleware lagao
router.use(requireLogin, requireRole("ADMIN"));

// ==============================================================
// DASHBOARD — Ek nazar mein sab kuch
// ==============================================================

// GET /api/admin/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const today     = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd   = new Date(today.setHours(23, 59, 59, 999));

    // Parallel mein sab fetch karo — zyada fast hoga
    const [
      totalUsers,
      totalRooms,
      totalBookings,
      totalOrders,
      activeBookings,
      todayCheckIns,
      todayCheckOuts,
      pendingOrders,
      totalRevenue,
      monthRevenue,
    ] = await Promise.all([

      // Users
      User.countDocuments({ role: "GUEST" }),

      // Rooms
      Room.countDocuments({ isAvailable: true }),

      // Bookings
      Booking.countDocuments(),

      // Orders
      Order.countDocuments(),

      // Abhi kitne log reh rahe hain
      Booking.countDocuments({ status: "CheckedIn" }),

      // Aaj check-in
      Booking.countDocuments({
        status:  "Confirmed",
        checkIn: { $gte: todayStart, $lte: todayEnd },
      }),

      // Aaj check-out
      Booking.countDocuments({
        status:   "CheckedIn",
        checkOut: { $gte: todayStart, $lte: todayEnd },
      }),

      // Pending orders — Pending + Confirmed + Preparing
      Order.countDocuments({ status: { $in: ["Pending", "Confirmed", "Preparing"] } }),

      // Total revenue — sirf paid bookings
      Booking.aggregate([
        { $match: { "payment.status": "Paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),

      // Is mahine ki revenue
      Booking.aggregate([
        {
          $match: {
            "payment.status": "Paid",
            createdAt: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ]);

    res.json({
      success: true,
      dashboard: {
        users: {
          totalGuests: totalUsers,
        },
        rooms: {
          totalAvailable: totalRooms,
          currentlyOccupied: activeBookings,
        },
        bookings: {
          total:          totalBookings,
          activeGuests:   activeBookings,
          todayCheckIns,
          todayCheckOuts,
        },
        orders: {
          total:   totalOrders,
          pending: pendingOrders,
        },
        revenue: {
          allTime:    totalRevenue[0]?.total  || 0,
          thisMonth:  monthRevenue[0]?.total  || 0,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================
// REVENUE BREAKDOWN
// ==============================================================

// GET /api/admin/revenue?months=6
router.get("/revenue", async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;

    // Last N months ka revenue — month wise
    const revenueData = await Booking.aggregate([
      {
        $match: {
          "payment.status": "Paid",
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - months)),
          },
        },
      },
      {
        $group: {
          _id: {
            year:  { $year:  "$createdAt" },
            month: { $month: "$createdAt" },
          },
          revenue:       { $sum: "$totalAmount" },
          bookingsCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Room type wise revenue
    const roomTypeRevenue = await Booking.aggregate([
      { $match: { "payment.status": "Paid" } },
      {
        $lookup: {
          from:         "rooms",
          localField:   "room",
          foreignField: "_id",
          as:           "roomData",
        },
      },
      { $unwind: "$roomData" },
      {
        $group: {
          _id:     "$roomData.type",
          revenue: { $sum: "$totalAmount" },
          count:   { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Restaurant revenue
    const restaurantRevenue = await Order.aggregate([
      { $match: { paymentStatus: "Paid" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    res.json({
      success: true,
      revenue: {
        monthly:    revenueData,
        byRoomType: roomTypeRevenue,
        restaurant: restaurantRevenue[0]?.total || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================
// OCCUPANCY
// ==============================================================

// GET /api/admin/occupancy
router.get("/occupancy", async (req, res) => {
  try {
    const totalRooms = await Room.countDocuments({ isAvailable: true, type: { $ne: "Dormitory" } });

    // Aaj kitne rooms occupied hain
    const occupiedToday = await Booking.countDocuments({
      status:   "CheckedIn",
      checkIn:  { $lte: new Date() },
      checkOut: { $gte: new Date() },
    });

    // Room type wise occupancy
    const occupancyByType = await Booking.aggregate([
      { $match: { status: "CheckedIn" } },
      {
        $lookup: {
          from:         "rooms",
          localField:   "room",
          foreignField: "_id",
          as:           "roomData",
        },
      },
      { $unwind: "$roomData" },
      {
        $group: {
          _id:   "$roomData.type",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      occupancy: {
        totalRooms,
        occupiedToday,
        vacantToday:       totalRooms - occupiedToday,
        occupancyRate:     totalRooms ? Math.round((occupiedToday / totalRooms) * 100) : 0,
        byRoomType:        occupancyByType,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================
// USERS MANAGEMENT
// ==============================================================

// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const { role, search } = req.query;

    const filter = {};
    if (role)   filter.role = role;
    if (search) filter.name = { $regex: search, $options: "i" }; // Case-insensitive search

    const users = await User.find(filter).sort({ createdAt: -1 });

    res.json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/users/:id — User detail + unki bookings
router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User nahi mila" });
    }

    // Is user ki bookings bhi fetch karo
    const bookings = await Booking.find({ guest: req.params.id })
      .populate("room", "roomNumber name type")
      .sort({ createdAt: -1 })
      .limit(10);

    // Total spending
    const spending = await Booking.aggregate([
      { $match: { guest: new mongoose.Types.ObjectId(req.params.id), "payment.status": "Paid" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    res.json({
      success: true,
      user,
      bookings,
      totalSpending: spending[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/admin/users/:id/role — Role change karo
router.patch("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;

    if (!["GUEST", "STAFF", "ADMIN"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Valid roles: GUEST, STAFF, ADMIN",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User nahi mila" });
    }

    res.json({ success: true, message: `${user.name} ka role ${role} ho gaya!`, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req, res) => {
  try {
    // Apne aap ko delete mat karo
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Apne aap ko delete nahi kar sakte!",
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User nahi mila" });
    }

    res.json({ success: true, message: "User delete ho gaya!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================
// BOOKINGS MANAGEMENT
// ==============================================================

// GET /api/admin/bookings
router.get("/bookings", async (req, res) => {
  try {
    const { status, date } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (date) {
      const d = new Date(date);
      filter.checkIn = {
        $gte: new Date(d.setHours(0, 0, 0, 0)),
        $lte: new Date(d.setHours(23, 59, 59, 999)),
      };
    }

    const bookings = await Booking.find(filter)
      .populate("guest", "name email phone")
      .populate("room",  "roomNumber name type floor")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: bookings.length, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/bookings/today — Aaj ke check-ins aur check-outs
router.get("/bookings/today", async (req, res) => {
  try {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd   = new Date(new Date().setHours(23, 59, 59, 999));

    const [checkIns, checkOuts] = await Promise.all([
      Booking.find({
        status:  "Confirmed",
        checkIn: { $gte: todayStart, $lte: todayEnd },
      })
        .populate("guest", "name email phone")
        .populate("room",  "roomNumber name floor"),

      Booking.find({
        status:   "CheckedIn",
        checkOut: { $gte: todayStart, $lte: todayEnd },
      })
        .populate("guest", "name email phone")
        .populate("room",  "roomNumber name floor"),
    ]);

    res.json({
      success: true,
      today: {
        checkIns:  { count: checkIns.length,  bookings: checkIns },
        checkOuts: { count: checkOuts.length, bookings: checkOuts },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================
// ORDERS MANAGEMENT
// ==============================================================

// GET /api/admin/orders
router.get("/orders", async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate("guest",        "name email phone")
      .populate("items.menuItem", "name price")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/orders/pending — Kitchen ke liye pending orders
router.get("/orders/pending", async (req, res) => {
  try {
    const orders = await Order.find({
      status: { $in: ["Pending", "Confirmed", "Preparing"] },
    })
      .populate("guest",          "name")
      .populate("items.menuItem", "name")
      .sort({ createdAt: 1 }); // Purane orders pehle — FIFO

    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================
// ROOMS MANAGEMENT
// ==============================================================

// PATCH /api/admin/rooms/:id/toggle — Available/Unavailable toggle
router.patch("/rooms/:id/toggle", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: "Room nahi mila" });
    }

    room.isAvailable = !room.isAvailable;
    await room.save();

    res.json({
      success: true,
      message: `Room ${room.roomNumber} ab ${room.isAvailable ? "✅ Available" : "❌ Unavailable"} hai`,
      room,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/revenue/daily — Last 30 days ka revenue
router.get("/revenue/daily", async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyRevenue = await Booking.aggregate([
      {
        $match: {
          "payment.status": "Paid",
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            year:  { $year:  "$createdAt" },
            month: { $month: "$createdAt" },
            day:   { $dayOfMonth: "$createdAt" },
          },
          revenue:  { $sum: "$totalAmount" },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Format for chart
    const formatted = dailyRevenue.map(d => ({
      date:     `${d._id.day}/${d._id.month}`,
      revenue:  d.revenue,
      bookings: d.bookings,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;