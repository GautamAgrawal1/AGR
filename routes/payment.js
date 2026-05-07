// routes/payment.js
// -------------------------------------------------------
// PAYMENT ROUTES:
//
// ROOM BOOKING PAYMENT:
// POST /api/payment/booking/create-order   — Razorpay order banao
// POST /api/payment/booking/verify         — Payment verify karo
//
// RESTAURANT ORDER PAYMENT:
// POST /api/payment/order/create-order     — Restaurant order ka payment
// POST /api/payment/order/verify           — Verify karo
//
// FLOW SAMJHO:
// 1. User "Pay Now" click karta hai
// 2. Frontend → /create-order → Razorpay order ID milta hai
// 3. Razorpay popup khulta hai user ke screen pe
// 4. User card/UPI se pay karta hai
// 5. Razorpay → Frontend ko payment details deta hai
// 6. Frontend → /verify → Hum confirm karte hain
// 7. Booking/Order "Confirmed" ho jaati hai ✅
// -------------------------------------------------------

const express  = require("express");
const Booking  = require("../models/Booking");
const Order    = require("../models/Order");
const User     = require("../models/User");
const { createOrder, verifyPayment } = require("../services/payment");
const { sendBookingConfirmation, sendPaymentConfirmation } = require("../services/email");
const { requireLogin } = require("../middlewares/auth");

const router = express.Router();

// ==============================================================
// ROOM BOOKING PAYMENT
// ==============================================================

// POST /api/payment/booking/create-order
// Frontend yahan aata hai jab user "Pay Now" click karta hai
router.post("/booking/create-order", requireLogin, async (req, res) => {
  try {
    const { bookingId } = req.body;

    // Booking dhundo
    const booking = await Booking.findById(bookingId).populate("room", "roomNumber name");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking nahi mili" });
    }

    // Sirf apni booking ka payment karo
    if (booking.guest.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Yeh tumhari booking nahi hai" });
    }

    // Already paid toh dobara mat karo
    if (booking.payment.status === "Paid") {
      return res.status(400).json({ success: false, message: "Is booking ka payment ho chuka hai" });
    }

    // Razorpay pe order banao
    const razorpayOrder = await createOrder(
      booking.totalAmount,
      "INR",
      `booking_${bookingId}`
    );

    // Razorpay order ID booking mein save karo
    booking.payment.razorpayOrderId = razorpayOrder.id;
    await booking.save();

    // Frontend ko yeh data chahiye Razorpay popup kholne ke liye
    res.json({
      success: true,
      order: {
        id:       razorpayOrder.id,
        amount:   razorpayOrder.amount, // Paise mein
        currency: razorpayOrder.currency,
      },
      booking: {
        id:          booking._id,
        roomNumber:  booking.room.roomNumber,
        totalAmount: booking.totalAmount,
      },
      // Frontend ko yeh key bhi chahiye Razorpay initialize karne ke liye
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/payment/booking/verify
// Payment hone ke BAAD frontend yahan aata hai
router.post("/booking/verify", requireLogin, async (req, res) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // Signature verify karo — genuine payment hai?
    const isGenuine = verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isGenuine) {
      return res.status(400).json({
        success: false,
        message: "Payment verify nahi hua — transaction genuine nahi lagta!",
      });
    }

    // Booking update karo — Confirmed + Paid
    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        status: "Confirmed",
        payment: {
          razorpayOrderId:   razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          status:            "Paid",
        },
      },
      { new: true }
    ).populate("room", "roomNumber name type");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking nahi mili" });
    }

    // Confirmation email bhejo — background mein (await nahi, user wait na kare)
    try {
      const guest = await User.findById(booking.guest);
      if (guest) {
        sendPaymentConfirmation(guest, booking, booking.room).catch(err =>
          console.warn("Email send failed (non-critical):", err.message)
        );
      }
    } catch (e) {
      console.warn("Email lookup failed:", e.message);
    }

    res.json({
      success: true,
      message: `Payment successful! Room ${booking.room.roomNumber} confirm ho gaya 🎉`,
      booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================
// RESTAURANT ORDER PAYMENT
// ==============================================================

// POST /api/payment/order/create-order
router.post("/order/create-order", requireLogin, async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order nahi mila" });
    }

    if (order.guest.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Yeh tumhara order nahi hai" });
    }

    if (order.paymentStatus === "Paid") {
      return res.status(400).json({ success: false, message: "Is order ka payment ho chuka hai" });
    }

    const razorpayOrder = await createOrder(
      order.totalAmount,
      "INR",
      `order_${orderId}`
    );

    res.json({
      success: true,
      order: {
        id:       razorpayOrder.id,
        amount:   razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/payment/order/verify
router.post("/order/verify", requireLogin, async (req, res) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const isGenuine = verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isGenuine) {
      return res.status(400).json({
        success: false,
        message: "Payment verify nahi hua!",
      });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { paymentStatus: "Paid" },
      { new: true }
    );

    res.json({
      success: true,
      message: "Payment successful! Order confirm ho gaya 🎉",
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;