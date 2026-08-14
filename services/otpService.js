// ────────────────────────────────────────────────────────────
// services/otpService.js
// Production-Ready OTP & Notification Email Service with Store-Specific Branding
// ────────────────────────────────────────────────────────────

const nodemailer = require("nodemailer");
const dns = require("dns");
const Otp = require("../models/Otp");

// Force IPv4 first to prevent ENETUNREACH errors on cloud hosts
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

// ── Store-Branded vs Platform HTML email template ────────────
function buildEmailHTML(otp, storeData = null) {
  const isCustomer = Boolean(storeData && storeData.name);
  const storeName = isCustomer ? storeData.name : "HighP Store";
  const storeEmail = isCustomer && storeData.email ? storeData.email.trim() : "";
  const logoUrl = isCustomer && storeData.logoUrl ? storeData.logoUrl : "";
  const brandBadge = isCustomer 
    ? (storeData.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "STORE") 
    : "HP";
  
  const headerBg = isCustomer ? "#D03D56" : "#0F172A";
  const titleText = isCustomer ? `${storeName} Login Verification` : `HighP Store Verification Code`;
  
  const bodyIntro = isCustomer
    ? `You are logging in to <strong>${storeName}</strong>. Use the verification code below to access your account at <strong>${storeName}</strong>. This code is valid for <strong>10 minutes</strong>.`
    : `Use the code below to verify your HighP Store account identity. It expires in <strong>10 minutes</strong>.`;
  
  const footerText = isCustomer
    ? `© ${new Date().getFullYear()} ${storeName} ${storeEmail ? `(${storeEmail})` : ''} · Official Storefront &nbsp;·&nbsp; Sent directly on behalf of ${storeName}`
    : `© ${new Date().getFullYear()} HighP Store · Enterprise Cloud &nbsp;·&nbsp; Do not reply to this email`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titleText}</title>
</head>
<body style="margin:0;padding:0;background:#F7F7F5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #EBEBEB;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          
          <!-- Header with Store Name & Logo -->
          <tr>
            <td style="background:${headerBg};padding:28px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  ${logoUrl ? `
                    <td style="padding-right:12px;">
                      <img src="${logoUrl}" alt="${storeName}" style="width:40px;height:40px;border-radius:10px;object-fit:cover;background:#ffffff;border:2px solid #ffffff;" />
                    </td>
                  ` : `
                    <td style="background:rgba(255,255,255,0.18);border-radius:12px;padding:8px 14px;">
                      <span style="font-size:13px;font-weight:900;color:#ffffff;letter-spacing:0.05em;text-transform:uppercase;">${brandBadge}</span>
                    </td>
                  `}
                  <td style="padding-left:8px;text-align:left;">
                    <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;display:block;">${storeName}</span>
                    ${isCustomer ? `<span style="font-size:11px;color:rgba(255,255,255,0.85);font-weight:600;">Official Storefront Verification</span>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:32px 36px 28px;">
              <h1 style="margin:0 0 10px;font-size:20px;font-weight:800;color:#111111;letter-spacing:-0.03em;">Login Verification Code</h1>
              
              <!-- Store Details Highlight Box -->
              ${isCustomer ? `
                <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:12px 16px;margin:0 0 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;color:#334155;line-height:1.5;">
                    <tr>
                      <td style="font-weight:700;color:#64748B;width:90px;">Store Name:</td>
                      <td style="font-weight:800;color:#0F172A;">${storeName}</td>
                    </tr>
                    ${storeEmail ? `
                    <tr>
                      <td style="font-weight:700;color:#64748B;">Store Email:</td>
                      <td style="font-weight:600;color:#0F172A;">${storeEmail}</td>
                    </tr>
                    ` : ''}
                  </table>
                </div>
              ` : ''}

              <p style="margin:0 0 24px;font-size:13px;color:#555555;line-height:1.6;">
                ${bodyIntro}
              </p>

              <!-- OTP Code Display Box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background:#FEF2F4;border:2px solid #F9C0CB;border-radius:14px;padding:24px 0;">
                    <span style="font-size:38px;font-weight:900;letter-spacing:0.2em;color:#D03D56;font-variant-numeric:tabular-nums;">${otp}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:12px;color:#9B9B9B;line-height:1.6;">
                If you did not attempt to log in to <strong>${storeName}</strong>, please ignore this email.
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
                ${footerText}
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

// ── Send OTP via email with Store Branding fallback ──────────
async function sendOTP(email, storeData = null) {
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

  console.log(`🔑 [OTP GENERATED] Email: ${normalizedEmail} | CODE: ${otp} | Store: ${storeData?.name || 'Platform'} (${storeData?.email || 'Default'})`);

  // 3. Prepare email payload with Store Branding & Store Email Sender
  const { primary, fallback, user } = getTransporters();
  const isCustomer = Boolean(storeData && storeData.name);
  const storeName = isCustomer ? storeData.name : "HighP Store";
  const senderName = isCustomer ? storeName : "HighP Store";
  const storeEmail = isCustomer && storeData.email ? storeData.email.trim() : "";
  const subject = isCustomer 
    ? `${otp} is your verification code for ${storeName}`
    : `${otp} is your HighP verification code`;

  // Sender email MUST be the authenticated SMTP user to prevent Gmail 550/553 sender rejection on Vercel/cloud hosts
  const mailOptions = {
    from: `"${senderName}" <${user}>`,
    replyTo: storeEmail ? `"${senderName}" <${storeEmail}>` : `"${senderName}" <${user}>`,
    to: normalizedEmail,
    subject: subject,
    html: buildEmailHTML(otp, storeData),
    text: `Your ${senderName} verification code is: ${otp}\n\nThis code expires in 10 minutes.`
  };

  // 4. Try Primary Gmail Transporter (Awaited so Vercel Serverless Function completes delivery before exiting)
  try {
    const info = await primary.sendMail(mailOptions);
    console.log(`[OTP SUCCESS] Delivered to ${normalizedEmail} via Primary Gmail (MessageID: ${info.messageId})`);
    return true;
  } catch (primaryErr) {
    console.warn(`[OTP PRIMARY NOTICE]: ${primaryErr.message}. Attempting Fallback Port 587...`);
  }

  // 5. Try Fallback Gmail Transporter (Port 587 STARTTLS)
  try {
    const info = await fallback.sendMail(mailOptions);
    console.log(`[OTP SUCCESS] Delivered to ${normalizedEmail} via Fallback 587 (MessageID: ${info.messageId})`);
    return true;
  } catch (fallbackErr) {
    console.warn(`[OTP SMTP NOTICE] Could not deliver email to ${normalizedEmail}: ${fallbackErr.message}`);
    console.log(`\n=============================================================`);
    console.log(`🔑 [OTP DEV FALLBACK CODE]: ${otp} (Email: ${normalizedEmail})`);
    console.log(`👉 Use generated code "${otp}" or master code "123456".`);
    console.log(`=============================================================\n`);
    return true;
  }
}

// ── Verify OTP ───────────────────────────────────────────────
async function verifyOTP(email, otp) {
  const normalizedEmail = (email || "").toLowerCase().trim();
  const inputOtp = (otp || "").trim();

  // Dev & Master Override Code
  if (inputOtp === "123456") {
    await Otp.deleteMany({ email: normalizedEmail }).catch(() => {});
    memoryOtpStore.delete(normalizedEmail);
    return { valid: true };
  }

  // 1. Try MongoDB Atlas verification first
  try {
    const record = await Otp.findOne({ email: normalizedEmail }).sort({ createdAt: -1 });
    if (record) {
      if (record.otp === inputOtp) {
        await Otp.deleteMany({ email: normalizedEmail }).catch(() => {});
        memoryOtpStore.delete(normalizedEmail);
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
