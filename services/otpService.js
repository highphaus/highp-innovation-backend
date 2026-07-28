// ────────────────────────────────────────────────────────────
// services/otpService.js
// Persistent MongoDB Atlas OTP + Robust Multi-Transport Nodemailer
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

// ── Transporter Config — Dual Port Fallback (Port 587 / 465) ──
function getTransporter(forcedPort) {
  const user = (process.env.SMTP_USER || "highphaus@gmail.com").trim();
  const rawPass = (process.env.SMTP_PASS || "jvdshhpqzhgageqt").trim();
  const pass = rawPass.replace(/\s+/g, ""); // Strip spaces from Gmail App Password
  const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  
  const defaultPort = Number(process.env.SMTP_PORT) || 587;
  const port = forcedPort || defaultPort;
  const isSecure = port === 465;

  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: isSecure,
    family: 4, // Force IPv4 socket connection
    lookup: ipv4Lookup, // Custom DNS lookup forcing IPv4
    auth: {
      user: user,
      pass: pass,
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 4000
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

// ── Send OTP via email (Fast Parallel Dual-Port Race) ─────────────
async function sendOTP(email) {
  const otp = generateOTP();
  const normalizedEmail = (email || "").toLowerCase().trim();

  // 1. Save OTP to memory store
  memoryOtpStore.set(normalizedEmail, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

  // 2. Persist in MongoDB Atlas asynchronously in background
  Otp.deleteMany({ email: normalizedEmail })
    .then(() => Otp.create({ email: normalizedEmail, otp }))
    .catch((dbErr) => {
      console.warn(`[OTP DB SAVE]:`, dbErr.message);
    });

  // Always log for server debugging
  console.log(`\n======================================\n[OTP GENERATED] Email: ${normalizedEmail}\nCode: ${otp}\n======================================\n`);

  // 3. Attempt email delivery
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  
  // Method A: Resend HTTP API (Port 443 - 100% reliable on Render & Vercel)
  if (resendApiKey) {
    try {
      const resendFrom = process.env.RESEND_FROM || "HighP Platform <onboarding@resend.dev>";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [normalizedEmail],
          subject: `${otp} is your HighP verification code`,
          html: buildEmailHTML(otp)
        })
      });
      const data = await response.json();
      if (response.ok) {
        console.log(`[OTP SUCCESS] Delivered via Resend HTTP API to ${normalizedEmail} (ID: ${data.id})`);
        return true;
      } else {
        console.warn(`[OTP RESEND WARN]:`, data);
      }
    } catch (resendErr) {
      console.warn(`[OTP RESEND ERROR]:`, resendErr.message);
    }
  }

  // Method B: Nodemailer Dual-Port Race (For Localhost)
  const smtpUser = (process.env.SMTP_USER || "highphaus@gmail.com").trim();
  const smtpFrom = process.env.SMTP_FROM || `"HighP Platform" <${smtpUser}>`;

  const mailOptions = {
    from: smtpFrom,
    to: normalizedEmail,
    subject: `${otp} is your HighP verification code`,
    html: buildEmailHTML(otp),
    text: `Your HighP verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
  };

  const attempt587 = getTransporter(587).sendMail(mailOptions);
  const attempt465 = getTransporter(465).sendMail(mailOptions);

  try {
    const result = await Promise.any([attempt587, attempt465]);
    console.log(`[OTP SUCCESS] Email delivered successfully to ${normalizedEmail} (MessageID: ${result.messageId})`);
    return true;
  } catch (err) {
    console.error(`[OTP ERROR] Email delivery failed on both ports:`, err.message || err);
    return true;
  }
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
