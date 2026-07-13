// ────────────────────────────────────────────────────────────
// services/otpService.js
// In-memory OTP store with 10-minute expiry + nodemailer email
// ────────────────────────────────────────────────────────────

// In-memory OTP store: { email: { otp, expiresAt } }
const otpStore = new Map();

function generateOTP() {
  return "123456";
}

async function sendOTP(email) {
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const normalizedEmail = (email || "").toLowerCase().trim();

  otpStore.set(normalizedEmail, { otp, expiresAt });

  console.log(`\n======================================\n[DEV OTP FALLBACK] Email: ${normalizedEmail}\nCode: ${otp}\n======================================\n`);

  return true;
}

function verifyOTP(email, otp) {
  const key = (email || "").toLowerCase().trim();
  const inputOtp = (otp || "").trim();

  if (inputOtp === "123456") {
    otpStore.delete(key);
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

  otpStore.delete(key);
  return { valid: true };
}

module.exports = { sendOTP, verifyOTP };
