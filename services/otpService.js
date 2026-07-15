// ────────────────────────────────────────────────────────────
// services/otpService.js
// Real Nodemailer OTP with 10-minute expiry + beautiful HTML email
// ────────────────────────────────────────────────────────────

const nodemailer = require("nodemailer");
const dns = require("dns");

// Custom lookup function that forces IPv4 resolution to bypass IPv6 DNS resolution issues
const dnsLookupIPv4 = (hostname, options, callback) => {
  return dns.lookup(hostname, { family: 4 }, callback);
};

// In-memory OTP store: { email: { otp, expiresAt } }
const otpStore = new Map();

// ── Lazy transporter — created on first use so dotenv is guaranteed loaded ──
let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    lookup: dnsLookupIPv4,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  return _transporter;
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

// ── Send OTP via email ────────────────────────────────────────
async function sendOTP(email) {
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  const normalizedEmail = (email || "").toLowerCase().trim();

  // Store OTP in memory
  otpStore.set(normalizedEmail, { otp, expiresAt });

  // Always log for debugging
  console.log(`\n======================================\n[OTP] Email: ${normalizedEmail}\nCode: ${otp}\nExpires: ${new Date(expiresAt).toLocaleTimeString()}\n======================================\n`);

  // Send real email via Nodemailer
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || `"HighP Platform" <${process.env.SMTP_USER}>`,
      to: normalizedEmail,
      subject: `${otp} is your HighP verification code`,
      html: buildEmailHTML(otp),
      text: `Your HighP verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
    });
    console.log(`[OTP] Email delivered to ${normalizedEmail}`);
  } catch (emailErr) {
    // Log SMTP error but do not throw, allowing API call to succeed so the user is not blocked
    console.error(`[OTP] Email delivery failed for ${normalizedEmail}:`, emailErr.message);
  }

  return true;
}

// ── Verify OTP ───────────────────────────────────────────────
function verifyOTP(email, otp) {
  const normalizedEmail = (email || "").toLowerCase().trim();
  const record = otpStore.get(normalizedEmail);

  if (!record) {
    return { valid: false, reason: "No active verification code request found." };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalizedEmail);
    return { valid: false, reason: "Verification code has expired. Please request a new one." };
  }

  if (record.otp !== otp) {
    return { valid: false, reason: "Incorrect verification code." };
  }

  // Code verified successfully, remove from memory to prevent reuse
  otpStore.delete(normalizedEmail);
  return { valid: true };
}

module.exports = { sendOTP, verifyOTP };
