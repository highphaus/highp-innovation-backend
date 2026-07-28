// ────────────────────────────────────────────────────────────
// services/otpService.js
// Persistent MongoDB Atlas OTP + Instant Non-Blocking Nodemailer
// ────────────────────────────────────────────────────────────

const nodemailer = require("nodemailer");
const Otp = require("../models/Otp");

// In-memory fallback if DB unavailable
const memoryOtpStore = new Map();

// ── Transporter Config — Supports Vercel Serverless Port 587 / 465 ──
function getTransporter() {
  const port = Number(process.env.SMTP_PORT) || 587;
  const isSecure = port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: port,
    secure: isSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

// ── Generate 6-digit random OTP ──────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Beautiful HTML email template ────────────────────────────
function buildEmailHTML(otp) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your HighP Verification Code</title>
</head>
<body style="margin:0;padding:0;background:#F7F7F5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #EBEBEB;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          
          <!-- Header -->
          <tr>
            <td style="background:#D03D56;padding:28px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:rgba(255,255,255,0.15);border-radius:12px;padding:8px 14px;">
                    <span style="font-size:13px;font-weight:900;color:#ffffff;letter-spacing:0.05em;text-transform:uppercase;">HP</span>
                  </td>
                  <td style="padding-left:10px;">
                    <span style="font-size:15px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">HighP Platform</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#111111;letter-spacing:-0.03em;">Verification Code</h1>
              <p style="margin:0 0 28px;font-size:13px;color:#737373;line-height:1.6;">
                Use the code below to verify your identity. It expires in <strong>10 minutes</strong>.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background:#FEF2F4;border:2px solid #F9C0CB;border-radius:14px;padding:24px 0;">
                    <span style="font-size:38px;font-weight:900;letter-spacing:0.2em;color:#D03D56;font-variant-numeric:tabular-nums;">${otp}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:12px;color:#9B9B9B;line-height:1.6;">
                If you did not request this code, you can safely ignore this email. Your account remains secure.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:#F0EEEB;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#ABABAB;letter-spacing:0.02em;">
                © ${new Date().getFullYear()} HighP Platform · Enterprise Cloud &nbsp;·&nbsp; Do not reply to this email
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ── Send OTP via email (MongoDB Atlas + Non-blocking instant response) ─────────────
async function sendOTP(email) {
  const otp = generateOTP();
  const normalizedEmail = (email || "").toLowerCase().trim();

  // 1. Save OTP to MongoDB Atlas (for persistent cross-function verification on Vercel)
  try {
    await Otp.deleteMany({ email: normalizedEmail });
    await Otp.create({ email: normalizedEmail, otp });
  } catch (dbErr) {
    console.warn(`[OTP] MongoDB save fallback to memory for ${normalizedEmail}:`, dbErr.message);
    memoryOtpStore.set(normalizedEmail, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  }

  // Always log for debugging
  console.log(`\n======================================\n[OTP GENERATED] Email: ${normalizedEmail}\nCode: ${otp}\n======================================\n`);

  // 2. Dispatch email in non-blocking background promise for instant API response
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = getTransporter();
      transporter.sendMail({
        from: process.env.SMTP_FROM || `"HighP Platform" <${process.env.SMTP_USER}>`,
        to: normalizedEmail,
        subject: `${otp} is your HighP verification code`,
        html: buildEmailHTML(otp),
        text: `Your HighP verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
      }).then(() => {
        console.log(`[OTP SUCCESS] Email delivered to ${normalizedEmail}`);
      }).catch((emailErr) => {
        console.error(`[OTP ERROR] Email delivery failed for ${normalizedEmail}:`, emailErr.message);
      });
    } catch (err) {
      console.error(`[OTP INITIALIZATION ERROR]:`, err.message);
    }
  } else {
    console.warn(`⚠️ [OTP WARNING] SMTP_USER or SMTP_PASS environment variable is missing on Vercel!`);
  }

  return true;
}

// ── Verify OTP (MongoDB Atlas persistent verification) ─────────────────────────
async function verifyOTP(email, otp) {
  const normalizedEmail = (email || "").toLowerCase().trim();
  const inputOtp = (otp || "").trim();

  // 1. Try MongoDB Atlas verification first
  try {
    const record = await Otp.findOne({ email: normalizedEmail }).sort({ createdAt: -1 });
    if (record) {
      if (record.otp === inputOtp) {
        await Otp.deleteMany({ email: normalizedEmail });
        return { valid: true };
      } else {
        return { valid: false, reason: "Incorrect verification code." };
      }
    }
  } catch (dbErr) {
    console.warn(`[OTP VERIFY] MongoDB fallback to memory for ${normalizedEmail}:`, dbErr.message);
  }

  // 2. Fallback to memory store if DB check had no record
  const memRecord = memoryOtpStore.get(normalizedEmail);
  if (!memRecord) {
    return { valid: false, reason: "No active verification code request found. Please request a new code." };
  }

  if (Date.now() > memRecord.expiresAt) {
    memoryOtpStore.delete(normalizedEmail);
    return { valid: false, reason: "Verification code has expired. Please request a new code." };
  }

  if (memRecord.otp !== inputOtp) {
    return { valid: false, reason: "Incorrect verification code." };
  }

  memoryOtpStore.delete(normalizedEmail);
  return { valid: true };
}

module.exports = { sendOTP, verifyOTP };
