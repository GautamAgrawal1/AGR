// services/payment.js
// -------------------------------------------------------
// YEH FILE KYA KARTI HAI:
// Razorpay ke saath baat karne ka kaam yahan hoga.
// Do main functions:
// 1. createOrder  — Razorpay pe order banao
// 2. verifyPayment — Payment genuine hai ya nahi check karo
//
// SEEKHNE WALI CHEEZ — HMAC Signature Verification:
// Jab Razorpay payment complete karta hai, woh ek
// "signature" bhejta hai. Hum apne secret key se
// same signature banate hain aur compare karte hain.
// Agar match kiya — payment genuine hai!
// -------------------------------------------------------

const Razorpay = require("razorpay");
const crypto   = require("crypto"); // Node.js built-in — install nahi karna

// Razorpay instance banao
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// -------------------------------------------------------
// ORDER CREATE — Razorpay ko batao kitna charge karna hai
// -------------------------------------------------------
const createOrder = async (amount, currency = "INR", receipt = "") => {
  const options = {
    amount:   amount * 100, // Razorpay PAISE mein leta hai — ₹1800 = 180000 paise
    currency,
    receipt:  receipt || `receipt_${Date.now()}`,
  };

  const order = await razorpay.orders.create(options);
  return order;
};

// -------------------------------------------------------
// PAYMENT VERIFY — Signature check karo
// Frontend se 3 cheezein aayengi:
// - razorpay_order_id
// - razorpay_payment_id
// - razorpay_signature
// -------------------------------------------------------
const verifyPayment = (orderId, paymentId, signature) => {
  // Yeh string banao: "order_id|payment_id"
  const body = orderId + "|" + paymentId;

  // Apne secret key se HMAC-SHA256 signature banao
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  // Compare karo — agar match kiya toh genuine payment!
  return expectedSignature === signature;
};

module.exports = { createOrder, verifyPayment };