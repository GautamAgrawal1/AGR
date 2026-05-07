// routes/restaurant.js
// -------------------------------------------------------
// MENU ROUTES:
// GET    /api/restaurant/menu           — Saara menu dekho
// GET    /api/restaurant/menu/:id       — Ek item dekho
// POST   /api/restaurant/menu           — Naya item add karo (ADMIN)
// PUT    /api/restaurant/menu/:id       — Item update karo (ADMIN)
// DELETE /api/restaurant/menu/:id       — Item delete karo (ADMIN)
//
// ORDER ROUTES:
// POST   /api/restaurant/orders         — Naya order place karo
// GET    /api/restaurant/orders         — Apne orders dekho
// GET    /api/restaurant/orders/:id     — Ek order ka detail
// PATCH  /api/restaurant/orders/:id/status — Status update (STAFF/ADMIN)
//
// TABLE ROUTES:
// POST   /api/restaurant/tables/reserve — Table book karo
// GET    /api/restaurant/tables         — Apni reservations dekho
// PATCH  /api/restaurant/tables/:id/cancel — Cancel karo
// -------------------------------------------------------

const express = require("express");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const TableReservation = require("../models/TableReservation");
const { requireLogin, requireRole } = require("../middlewares/auth");

const router = express.Router();

// ==============================================================
// MENU ROUTES
// ==============================================================

// GET /api/restaurant/menu — Saara menu
// Admin ko sab milega (isAvailable false bhi), baaki ko sirf available
router.get("/menu", async (req, res) => {
  try {
    const { category, isVeg, all } = req.query;

    // Admin "all=true" pass kare toh sab items milenge
    const filter = all === "true" ? {} : { isAvailable: true };
    if (category) filter.category = category;
    if (isVeg !== undefined) filter.isVeg = isVeg === "true";

    const menuItems = await MenuItem.find(filter).sort({ category: 1, name: 1 });

    res.json({
      success: true,
      count: menuItems.length,
      menu: menuItems,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/restaurant/menu/:id — Ek item
router.get("/menu/:id", async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: "Item nahi mila" });
    }

    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/restaurant/menu — Naya item add karo (sirf ADMIN)
router.post("/menu", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    // Duplicate check — same name + category already hai?
    const existing = await MenuItem.findOne({
      name:     { $regex: new RegExp("^" + req.body.name + "$", "i") },
      category: req.body.category,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `"${req.body.name}" already ${req.body.category} mein hai. Duplicate nahi add ho sakta.`,
      });
    }

    const item = await MenuItem.create(req.body);
    res.status(201).json({ success: true, message: "Menu item add ho gaya! 🍽️", item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/restaurant/menu/:id — Item delete (ADMIN)
router.delete("/menu/:id", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item nahi mila" });
    res.json({ success: true, message: `"${item.name}" delete ho gaya!` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/restaurant/menu/:id — Item update karo (sirf ADMIN)
router.put("/menu/:id", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true } // new:true = updated document return karo
    );

    if (!item) {
      return res.status(404).json({ success: false, message: "Item nahi mila" });
    }

    res.json({ success: true, message: "Update ho gaya!", item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/restaurant/menu/:id — Item delete karo (sirf ADMIN)
router.delete("/menu/:id", requireLogin, requireRole("ADMIN"), async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: "Item nahi mila" });
    }

    res.json({ success: true, message: "Item delete ho gaya!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================
// ORDER ROUTES
// ==============================================================

// POST /api/restaurant/orders — Naya order place karo
router.post("/orders", requireLogin, async (req, res) => {
  try {
    const { items, orderType, tableNumber, roomNumber, specialNote } = req.body;

    // Pehle validate karo — items array empty nahi honi chahiye
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Kuch toh order karo bhai 😄",
      });
    }

    // Har item ke liye database se price verify karo
    // (Frontend se aaya price trust mat karo — security!)
    let totalAmount = 0;
    const verifiedItems = [];

    for (const orderItem of items) {
      const menuItem = await MenuItem.findById(orderItem.menuItem);

      if (!menuItem) {
        return res.status(404).json({
          success: false,
          message: `Menu item nahi mila: ${orderItem.menuItem}`,
        });
      }

      if (!menuItem.isAvailable) {
        return res.status(400).json({
          success: false,
          message: `${menuItem.name} abhi available nahi hai`,
        });
      }

      const itemTotal = menuItem.price * orderItem.quantity;
      totalAmount += itemTotal;

      verifiedItems.push({
        menuItem: menuItem._id,
        quantity: orderItem.quantity,
        price: menuItem.price, // Database se liya — tamper-proof!
        specialInstructions: orderItem.specialInstructions || "",
      });
    }

    // Order create karo
    const order = await Order.create({
      guest: req.user._id,
      items: verifiedItems,
      orderType,
      tableNumber: tableNumber || null,
      roomNumber: roomNumber || null,
      totalAmount,
      specialNote: specialNote || "",
    });

    // Populate karke return karo — item names bhi dikhenge
    const populatedOrder = await Order.findById(order._id).populate(
      "items.menuItem",
      "name price category"
    );

    res.status(201).json({
      success: true,
      message: "Order place ho gaya! 🎉 Thoda wait karo.",
      order: populatedOrder,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/restaurant/orders — Apne orders dekho
router.get("/orders", requireLogin, async (req, res) => {
  try {
    let query = {};

    // GUEST sirf apne orders dekhe, STAFF/ADMIN sab dekh sakte hain
    if (req.user.role === "GUEST") {
      query.guest = req.user._id;
    }

    const orders = await Order.find(query)
      .populate("items.menuItem", "name price image")
      .populate("guest", "name email")
      .sort({ createdAt: -1 }); // Naaye orders pehle

    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/restaurant/orders/:id — Ek order ka detail
router.get("/orders/:id", requireLogin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.menuItem", "name price image category")
      .populate("guest", "name email phone");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order nahi mila" });
    }

    // GUEST sirf apna order dekh sakta hai
    if (
      req.user.role === "GUEST" &&
      order.guest._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Yeh tumhara order nahi hai",
      });
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/restaurant/orders/:id/status — Status update (STAFF ya ADMIN)
router.patch(
  "/orders/:id/status",
  requireLogin,
  requireRole("STAFF", "ADMIN"),
  async (req, res) => {
    try {
      const { status } = req.body;

      const validStatuses = [
        "Pending", "Confirmed", "Preparing", "Ready", "Delivered", "Cancelled",
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status galat hai. Valid: ${validStatuses.join(", ")}`,
        });
      }

      const order = await Order.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      ).populate("items.menuItem", "name");

      if (!order) {
        return res.status(404).json({ success: false, message: "Order nahi mila" });
      }

      res.json({
        success: true,
        message: `Order status update ho gaya: ${status}`,
        order,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ==============================================================
// TABLE RESERVATION ROUTES
// ==============================================================

// POST /api/restaurant/tables/reserve — Table book karo
router.post("/tables/reserve", requireLogin, async (req, res) => {
  try {
    const {
      guestName,
      guestPhone,
      numberOfGuests,
      reservationDate,
      reservationTime,
      tableNumber,
      specialRequest,
      occasion,
    } = req.body;

    // Check karo — kya table available hai?
    const isAvailable = await TableReservation.isTableAvailable(
      tableNumber,
      new Date(reservationDate),
      reservationTime
    );

    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: `Table ${tableNumber} is waqt already booked hai. Koi aur table ya time try karo.`,
      });
    }

    const reservation = await TableReservation.create({
      guest: req.user._id,
      guestName,
      guestPhone,
      numberOfGuests,
      reservationDate: new Date(reservationDate),
      reservationTime,
      tableNumber,
      specialRequest,
      occasion,
    });

    res.status(201).json({
      success: true,
      message: `Table ${tableNumber} book ho gayi! ${reservationTime} pe milte hain 🍽️`,
      reservation,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/restaurant/tables — Apni reservations dekho
router.get("/tables", requireLogin, async (req, res) => {
  try {
    let query = {};

    if (req.user.role === "GUEST") {
      query.guest = req.user._id;
    }

    const reservations = await TableReservation.find(query)
      .populate("guest", "name email")
      .sort({ reservationDate: 1 });

    res.json({ success: true, count: reservations.length, reservations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/restaurant/tables/:id/cancel — Reservation cancel karo
router.patch("/tables/:id/cancel", requireLogin, async (req, res) => {
  try {
    const reservation = await TableReservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({ success: false, message: "Reservation nahi mili" });
    }

    // Sirf apni reservation cancel kar sako, ya ADMIN cancel kare
    if (
      req.user.role === "GUEST" &&
      reservation.guest.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Yeh tumhari reservation nahi hai",
      });
    }

    reservation.status = "Cancelled";
    await reservation.save();

    res.json({
      success: true,
      message: "Reservation cancel ho gayi.",
      reservation,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;