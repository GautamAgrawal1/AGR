// services/email.js
// -------------------------------------------------------
// EMAIL SERVICE — Nodemailer se contact form ka email bhejo
//
// SETUP:
// Gmail use kar rahe hain — App Password chahiye
// Gmail → Settings → Security → 2FA ON → App Passwords
// -------------------------------------------------------

const nodemailer = require("nodemailer");

// Transporter — Gmail se email bhejega
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // tumhara gmail
    pass: process.env.EMAIL_PASS, // App Password (not regular password)
  },
});

// -------------------------------------------------------
// CONTACT FORM EMAIL
// Guest ka message hotel owner ko jaata hai
// -------------------------------------------------------
const sendContactEmail = async ({ name, email, phone, message }) => {
  const mailOptions = {
    from:    `"AGR Hotel Website" <${process.env.EMAIL_USER}>`,
    to:      process.env.EMAIL_USER, // Owner ko jaayega
    replyTo: email, // Reply karne pe guest ko jaayega directly
    subject: `New Message from ${name} — AGR Hotel Website`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#FDFAF5;border:1px solid #E8D5B8;border-radius:12px;overflow:hidden;">
        <div style="background:#C0392B;padding:24px 32px;">
          <h2 style="color:white;margin:0;font-size:22px;">New Message — AGR Hotel</h2>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">Website contact form se aaya hai</p>
        </div>
        <div style="padding:32px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #E8D5B8;color:#A0856C;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:100px;">Name</td>
              <td style="padding:10px 0;border-bottom:1px solid #E8D5B8;color:#2C1810;font-weight:600;">${name}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #E8D5B8;color:#A0856C;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #E8D5B8;color:#2C1810;"><a href="mailto:${email}" style="color:#C0392B;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #E8D5B8;color:#A0856C;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Phone</td>
              <td style="padding:10px 0;border-bottom:1px solid #E8D5B8;color:#2C1810;">${phone || "Not provided"}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#A0856C;font-size:12px;text-transform:uppercase;letter-spacing:1px;vertical-align:top;">Message</td>
              <td style="padding:10px 0;color:#2C1810;line-height:1.7;">${message.replace(/\n/g, "<br>")}</td>
            </tr>
          </table>
          <div style="margin-top:24px;padding:16px;background:#FFF8E7;border-radius:8px;border:1px solid #E8D5A3;">
            <p style="margin:0;font-size:13px;color:#6B4C35;">💡 Reply karne ke liye seedha is email pe reply karo — message directly <strong>${email}</strong> pe jaayega.</p>
          </div>
        </div>
        <div style="padding:16px 32px;background:#F7F2EA;text-align:center;font-size:12px;color:#A0856C;">
          AGR Hotel — Railway VIP Gate No.1, Behind Kali Mandir, G.T. Road, Mughalsarai
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// -------------------------------------------------------
// BOOKING CONFIRMATION EMAIL — Guest ko jaata hai
// -------------------------------------------------------
const sendBookingConfirmation = async (guest, booking, room) => {
  if (!guest.email) return;

  const checkIn  = new Date(booking.checkIn).toDateString();
  const checkOut = new Date(booking.checkOut).toDateString();

  const mailOptions = {
    from:    `"AGR Hotel" <${process.env.EMAIL_USER}>`,
    to:      guest.email,
    subject: `Booking Confirmed — ${room.name} | AGR Hotel`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#FDFAF5;border:1px solid #E8D5B8;border-radius:12px;overflow:hidden;">
        <div style="background:#C0392B;padding:24px 32px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:28px;">AGR HOTEL</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;">Booking Confirmed ✅</p>
        </div>
        <div style="padding:32px;">
          <p style="font-size:16px;color:#2C1810;">Namaste <strong>${guest.name}</strong>! 🙏</p>
          <p style="color:#6B4C35;margin-bottom:24px;">Aapki booking confirm ho gayi hai. Neeche details hain:</p>
          <div style="background:#F7F2EA;border-radius:10px;padding:20px;margin-bottom:20px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#A0856C;font-size:12px;text-transform:uppercase;width:130px;">Room</td>
                <td style="padding:8px 0;color:#2C1810;font-weight:600;">${room.name} (${room.roomNumber})</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#A0856C;font-size:12px;text-transform:uppercase;">Check-In</td>
                <td style="padding:8px 0;color:#2C1810;font-weight:600;">${checkIn}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#A0856C;font-size:12px;text-transform:uppercase;">Check-Out</td>
                <td style="padding:8px 0;color:#2C1810;font-weight:600;">${checkOut}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#A0856C;font-size:12px;text-transform:uppercase;">Amount</td>
                <td style="padding:8px 0;color:#C0392B;font-weight:700;font-size:18px;">₹${booking.totalAmount}</td>
              </tr>
            </table>
          </div>
          <div style="background:#FFF8E7;border:1px solid #E8D5A3;border-radius:8px;padding:16px;margin-bottom:24px;">
            <p style="margin:0;font-size:13px;color:#6B4C35;">📍 <strong>Address:</strong> Railway VIP Gate No.1, Behind Kali Mandir, G.T. Road, Mughalsarai</p>
          </div>
          <p style="color:#6B4C35;font-size:14px;">Koi bhi sawaal ho toh hume call karein ya is email pe reply karein.</p>
          <p style="color:#2C1810;font-weight:600;">Aapka intezaar hai! 🏨</p>
        </div>
        <div style="padding:16px 32px;background:#2C1810;text-align:center;font-size:12px;color:rgba(255,255,255,0.4);">
          © AGR Hotel, Mughalsarai. All rights reserved.
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// -------------------------------------------------------
// PAYMENT CONFIRMATION EMAIL — Payment hone ke baad guest ko jaata hai
// Booking details + Payment receipt dono ek saath
// -------------------------------------------------------
const sendPaymentConfirmation = async (guest, booking, room) => {
  if (!guest.email) return;

  const checkIn   = new Date(booking.checkIn).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const checkOut  = new Date(booking.checkOut).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const nights    = Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24));
  const paymentId = booking.payment?.razorpayPaymentId || "N/A";
  const orderId   = booking.payment?.razorpayOrderId   || "N/A";
  const paidOn    = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  const mailOptions = {
    from:    `"AGR Hotel" <${process.env.EMAIL_USER}>`,
    to:      guest.email,
    subject: `✅ Payment Confirmed — ${room.name} | AGR Hotel`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#F0EBE3;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:32px auto;background:#FDFAF5;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(44,24,16,0.10);">

          <!-- Header -->
          <div style="background:linear-gradient(135deg,#7B2D2D 0%,#C0392B 60%,#E8572A 100%);padding:36px 32px;text-align:center;">
            <div style="font-size:48px;margin-bottom:8px;">🏨</div>
            <h1 style="color:white;margin:0;font-size:26px;letter-spacing:2px;font-weight:700;">AGR HOTEL</h1>
            <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Payment Confirmed</p>
          </div>

          <!-- Success Badge -->
          <div style="background:#F0FDF4;border-bottom:2px solid #BBF7D0;padding:20px 32px;display:flex;align-items:center;gap:16px;">
            <div style="background:#22C55E;color:white;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">✓</div>
            <div>
              <p style="margin:0;font-size:16px;font-weight:700;color:#15803D;">Payment Successful!</p>
              <p style="margin:4px 0 0;font-size:13px;color:#166534;">Aapka ₹${booking.totalAmount} ka payment accept ho gaya hai</p>
            </div>
          </div>

          <!-- Body -->
          <div style="padding:32px;">
            <p style="font-size:16px;color:#2C1810;margin-bottom:4px;">Namaste <strong>${guest.name}</strong>! 🙏</p>
            <p style="color:#6B4C35;font-size:14px;line-height:1.7;margin-bottom:28px;">
              Aapki booking aur payment dono confirm ho gayi hai. Neeche aapka receipt aur booking details hain.
            </p>

            <!-- Booking Details -->
            <div style="background:#F7F2EA;border-radius:12px;padding:24px;margin-bottom:20px;">
              <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#A0856C;margin:0 0 16px;font-weight:600;">BOOKING DETAILS</p>
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #E8D5B8;color:#A0856C;font-size:12px;text-transform:uppercase;width:140px;">Room</td>
                  <td style="padding:10px 0;border-bottom:1px solid #E8D5B8;color:#2C1810;font-weight:600;">${room.name} — ${room.roomNumber}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #E8D5B8;color:#A0856C;font-size:12px;text-transform:uppercase;">Check-In</td>
                  <td style="padding:10px 0;border-bottom:1px solid #E8D5B8;color:#2C1810;font-weight:600;">📅 ${checkIn}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #E8D5B8;color:#A0856C;font-size:12px;text-transform:uppercase;">Check-Out</td>
                  <td style="padding:10px 0;border-bottom:1px solid #E8D5B8;color:#2C1810;font-weight:600;">📅 ${checkOut}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#A0856C;font-size:12px;text-transform:uppercase;">Duration</td>
                  <td style="padding:10px 0;color:#2C1810;font-weight:600;">${nights} Night${nights > 1 ? "s" : ""}</td>
                </tr>
              </table>
            </div>

            <!-- Payment Receipt -->
            <div style="background:#FFF8E7;border:1.5px solid #F0D060;border-radius:12px;padding:24px;margin-bottom:20px;">
              <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#B8860B;margin:0 0 16px;font-weight:600;">💳 PAYMENT RECEIPT</p>
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:8px 0;color:#A0856C;font-size:12px;text-transform:uppercase;width:140px;">Payment ID</td>
                  <td style="padding:8px 0;color:#2C1810;font-family:monospace;font-size:13px;">${paymentId}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#A0856C;font-size:12px;text-transform:uppercase;">Order ID</td>
                  <td style="padding:8px 0;color:#2C1810;font-family:monospace;font-size:13px;">${orderId}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#A0856C;font-size:12px;text-transform:uppercase;">Paid On</td>
                  <td style="padding:8px 0;color:#2C1810;">${paidOn}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;color:#A0856C;font-size:12px;text-transform:uppercase;">Total Paid</td>
                  <td style="padding:12px 0 0;color:#C0392B;font-weight:700;font-size:24px;">₹${booking.totalAmount}</td>
                </tr>
              </table>
            </div>

            <!-- Address -->
            <div style="background:#F7F2EA;border-left:4px solid #C0392B;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#6B4C35;line-height:1.7;">
                📍 <strong>Hotel Address:</strong><br>
                Railway VIP Gate No.1, Behind Kali Mandir,<br>
                G.T. Road, Mughalsarai — 232101
              </p>
            </div>

            <p style="color:#6B4C35;font-size:14px;line-height:1.7;">
              Koi sawaal ho toh reply karein ya call karein. Aapka hotel mein swagat hai! 🌟
            </p>
          </div>

          <!-- Footer -->
          <div style="padding:20px 32px;background:#2C1810;text-align:center;">
            <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0;">
              © AGR Hotel, Mughalsarai &nbsp;|&nbsp; Keep this email as your payment receipt
            </p>
          </div>

        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendContactEmail, sendBookingConfirmation, sendPaymentConfirmation };
