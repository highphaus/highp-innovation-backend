// ────────────────────────────────────────────────────────────
// services/otpService.js
// Production-Ready OTP Service with Dual Gmail SMTP Transporters & Robust Fallback
// ────────────────────────────────────────────────────────────

const nodemailer = require("nodemailer");
const dns = require("dns");
const Otp = require("../models/Otp");

// Force IPv4 first to prevent ENETUNREACH errors on cloud hosts like Render
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

// In-memory fallback if DB unavailable
const memoryOtpStore = new Map();

// Custom DNS lookup forcing IPv4 only
function ipv4Lookup(hostname, options, callback) {
  return dns.lookup(hostname, { family: 4 }, callback);
}

// ── Gmail Transporters (Primary Service & Fallback Port 587) ──
function getTransporters() {
  const user = (process.env.EMAIL_USER || process.env.SMTP_USER || process.env.MAIL_USER || "highphaus@gmail.com").trim();
  const rawPass = (process.env.EMAIL_PASS || process.env.SMTP_PASS || process.env.MAIL_PASS || "jvdshhpqzhgageqt").trim();
  const pass = rawPass.replace(/\s+/g, ""); // Strip spaces from Gmail App Password

  const primary = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    family: 4,
    lookup: ipv4Lookup,
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 12000
  });

  const fallback = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    family: 4,
    lookup: ipv4Lookup,
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 12000
  });

  return { primary, fallback, user };
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

// ── Send OTP via email ───────────────────────────────────────
async function sendOTP(email) {
  const otp = generateOTP();
  const normalizedEmail = (email || "").toLowerCase().trim();

  // 1. Save OTP to memory store
  memoryOtpStore.set(normalizedEmail, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

  // 2. Persist in MongoDB Atlas asynchronously
  Otp.deleteMany({ email: normalizedEmail })
    .then(() => Otp.create({ email: normalizedEmail, otp }))
    .catch((dbErr) => {
      console.warn(`[OTP DB SAVE]:`, dbErr.message);
    });

  console.log(`[OTP GENERATED] Email: ${normalizedEmail}`);

  // 3. Prepare email payload
  const { primary, fallback, user } = getTransporters();
  const mailOptions = {
    from: `"HighP Platform" <${user}>`,
    to: normalizedEmail,
    subject: `${otp} is your HighP verification code`,
    html: buildEmailHTML(otp),
    text: `Your HighP verification code is: ${otp}\n\nThis code expires in 10 minutes.`
  };

  // 4. Try Primary SMTP Transporter
  try {
    const info = await primary.sendMail(mailOptions);
    console.log(`[OTP SUCCESS] Email delivered to ${normalizedEmail} via Primary (MessageID: ${info.messageId})`);
    return true;
  } catch (primaryErr) {
    console.warn(`[OTP PRIMARY FAILED]: ${primaryErr.message}. Attempting fallback port 587...`);
  }

  // 5. Try Fallback SMTP Transporter (Port 587 STARTTLS)
  try {
    const info = await fallback.sendMail(mailOptions);
    console.log(`[OTP SUCCESS] Email delivered to ${normalizedEmail} via Fallback 587 (MessageID: ${info.messageId})`);
    return true;
  } catch (fallbackErr) {
    console.error(`[OTP FALLBACK FAILED] Email could not be sent to ${normalizedEmail}:`, {
      message: fallbackErr.message,
      code: fallbackErr.code
    });
    return false;
  }
}

// ── Verify OTP ───────────────────────────────────────────────
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
