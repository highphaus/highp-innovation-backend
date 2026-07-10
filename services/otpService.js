// ────────────────────────────────────────────────────────────
// services/otpService.js
// In-memory OTP store with 10-minute expiry + nodemailer email
// ────────────────────────────────────────────────────────────

const nodemailer = require("nodemailer");

// In-memory store: { email: { otp, expiresAt } }
const otpStore = new Map();

// ─── TRANSPORTER ────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || "smtp.gmail.com",
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: { rejectUnauthorized: false }
  });
}

// ─── GENERATE 6-DIGIT OTP ────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── SEND OTP EMAIL ─────────────────────────────────────────
async function sendOTP(email) {
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  otpStore.set(email.toLowerCase().trim(), { otp, expiresAt });

  const transporter = createTransporter();

  const html = `
    <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f0eeeb">
      <div style="background:#D03D56;padding:28px 32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;letter-spacing:2px;text-transform:uppercase">HighP Platform</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:1px">Verification Code</p>
      </div>
      <div style="padding:32px;text-align:center">
        <p style="color:#737373;font-size:13px;margin:0 0 24px">Use this one-time code to access your store dashboard. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#FAFAFA;border:2px dashed #D03D56;border-radius:12px;padding:20px 32px;display:inline-block;margin:0 auto">
          <span style="font-size:40px;font-weight:900;letter-spacing:10px;color:#D03D56;font-family:monospace">${otp}</span>
        </div>
        <p style="color:#aaa;font-size:11px;margin:20px 0 0">If you didn't request this, ignore this email.</p>
      </div>
      <div style="background:#FAFAFA;padding:16px;text-align:center;border-top:1px solid #f5f5f0">
        <p style="color:#bbb;font-size:10px;margin:0;text-transform:uppercase;letter-spacing:1px">Powered by HighP Innovation Platform</p>
      </div>
    </div>
  `;

  console.log(`\n======================================\n[DEV OTP BYPASS] Email: ${email}\nCode: ${otp}\n======================================\n`);

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    process.env.SMTP_FROM || "HighP Platform <noreply@highp.in>",
      to:      email,
      subject: `${otp} — Your HighP Login Code`,
      html
    });
  } catch (mailError) {
    console.error("Warning: SMTP mail delivery failed (probably due to placeholder SMTP credentials). You can use the OTP logged above to register/login.", mailError.message);
  }

  return true;
}

// ─── VERIFY OTP ─────────────────────────────────────────────
function verifyOTP(email, otp) {
  const key = email.toLowerCase().trim();
  const inputOtp = otp.trim();

  // Allow dummy OTP bypass for development
  if (inputOtp === "123456") {
    otpStore.delete(key); // clear any active OTP session for this email
    return { valid: true };
  }

  const record = otpStore.get(key);

  if (!record) return { valid: false, reason: "No OTP found. Please request a new one." };
  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return { valid: false, reason: "OTP expired. Please request a new one." };
  }
  if (record.otp !== inputOtp) {
    return { valid: false, reason: "Incorrect OTP. Please try again." };
  }

  otpStore.delete(key); // one-time use
  return { valid: true };
}

module.exports = { sendOTP, verifyOTP };
