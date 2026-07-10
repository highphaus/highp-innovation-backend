const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Store = require('../models/Store');
const { sendOTP, verifyOTP } = require('../services/otpService');

// ==========================
// GET ALL STORES
// GET /api/stores
// ==========================
router.get('/', async (req, res) => {
  try {
    const stores = await Store.find().select('-password');
    res.status(200).json(stores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// GET STORE BY SLUG
// GET /api/stores/:slug
// ==========================
router.get('/:slug', async (req, res) => {
  try {
    const store = await Store.findOne({
      slug: req.params.slug.toLowerCase().trim()
    }).select('-password');

    if (!store) {
      return res.status(404).json({
        message: "Tenant Profile Not Found"
      });
    }

    res.status(200).json(store);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// SEND OTP
// POST /api/stores/send-otp
// body: { email, purpose: 'register'|'login', storeName? }
// ==========================
router.post('/send-otp', async (req, res) => {
  try {
    const { email, purpose, storeName } = req.body;
    const cleanEmail = (email || "").toLowerCase().trim();

    if (!cleanEmail) return res.status(400).json({ message: "Email is required." });

    if (purpose === 'register') {
      // For registration: email must NOT already exist
      const existing = await Store.findOne({ email: cleanEmail });
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists. Please log in instead." });
      }
      if (!storeName || !storeName.trim()) {
        return res.status(400).json({ message: "Store name is required for registration." });
      }
    } else {
      // For login: email MUST exist
      const store = await Store.findOne({ email: cleanEmail });
      if (!store) {
        return res.status(404).json({ message: "No store found with this email. Please register first." });
      }
    }

    await sendOTP(cleanEmail);
    res.json({ message: "OTP sent successfully. Check your email." });

  } catch (err) {
    console.error("Send OTP error:", err);
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
});

// ==========================
// REGISTER STORE (OTP-verified, passwordless)
// POST /api/stores/register
// body: { name, email, otp }
// ==========================
router.post('/register', async (req, res) => {
  try {
    const { name, email, otp, softwareType } = req.body;
    const cleanEmail = (email || "").toLowerCase().trim();

    if (!name || !cleanEmail || !otp) {
      return res.status(400).json({ message: "Store name, email and OTP are required." });
    }

    // Verify OTP
    const result = verifyOTP(cleanEmail, otp);
    if (!result.valid) {
      return res.status(400).json({ message: result.reason });
    }

    // Check duplicate
    const existing = await Store.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ message: "An account with this email already exists." });
    }

    // Auto-generate slug from store name
    const formattedSlug = name.toLowerCase().trim()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');

    // Ensure slug is unique
    const slugExists = await Store.findOne({ slug: formattedSlug });
    const finalSlug = slugExists ? `${formattedSlug}${Date.now().toString().slice(-4)}` : formattedSlug;

    const store = await Store.create({
      name: name.trim(),
      slug: finalSlug,
      email: cleanEmail,
      password: await bcrypt.hash(Math.random().toString(36), 10), // random placeholder
      softwareType: softwareType || "restaurant",
      primaryColor: "text-[#D03D56]",
      bgColor: "bg-[#D03D56]",
      hoverColor: "hover:bg-[#3F0712]",
      isApproved: true,
      subscriptionPlan: "basic"
    });

    const token = jwt.sign(
      { storeId: store._id, slug: store.slug, role: "admin" },
      process.env.JWT_SECRET || "MNC_SUPER_SECRET_KEY",
      { expiresIn: "24h" }
    );

    res.status(201).json({
      token,
      slug: store.slug,
      name: store.name,
      email: store.email,
      isApproved: true
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ==========================
// LOGIN (OTP-verified, passwordless)
// POST /api/stores/login
// body: { email, otp }
// ==========================
router.post('/login', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const cleanEmail = (email || "").toLowerCase().trim();

    if (!cleanEmail || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    // Verify OTP
    const result = verifyOTP(cleanEmail, otp);
    if (!result.valid) {
      return res.status(400).json({ message: result.reason });
    }

    const store = await Store.findOne({ email: cleanEmail });
    if (!store) {
      return res.status(404).json({ message: "No store found with this email address." });
    }

    const token = jwt.sign(
      { storeId: store._id, slug: store.slug, role: "admin" },
      process.env.JWT_SECRET || "MNC_SUPER_SECRET_KEY",
      { expiresIn: "24h" }
    );

    return res.json({
      token,
      role: "admin",
      slug: store.slug,
      name: store.name
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// STAFF MANAGEMENT PORTAL GATEWAY ROUTES
// ==========================================
const Staff = require('../models/Staff');

// 1. GET /api/stores/:storeSlug/staff
router.get('/:storeSlug/staff', async (req, res) => {
  try {
    const slug = req.params.storeSlug.toLowerCase().trim();
    const staff = await Staff.find({ storeSlug: slug }).sort({ createdAt: -1 });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST /api/stores/:storeSlug/staff
router.post('/:storeSlug/staff', async (req, res) => {
  try {
    const slug = req.params.storeSlug.toLowerCase().trim();
    const { name, role, email, phone } = req.body;

    if (!name || !role || !email) {
      return res.status(400).json({ error: "Name, role, and email are required fields." });
    }

    // Check if staff email already registered for this store
    const existing = await Staff.findOne({ storeSlug: slug, email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ error: "A staff member with this email is already registered." });
    }

    const newStaff = await Staff.create({
      storeSlug: slug,
      name: name.trim(),
      role: role.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : "",
      status: "active"
    });

    res.status(201).json(newStaff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. DELETE /api/stores/:storeSlug/staff/:id
router.delete('/:storeSlug/staff/:id', async (req, res) => {
  try {
    const { storeSlug, id } = req.params;
    await Staff.findOneAndDelete({ _id: id, storeSlug: storeSlug.toLowerCase().trim() });
    res.json({ message: "Staff member deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SUPER ADMIN MANAGEMENT ENDPOINTS
// ==========================================

// 1. PATCH /api/stores/:id/approve
router.patch('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    const store = await Store.findByIdAndUpdate(
      id,
      { isApproved },
      { new: true }
    ).select('-password');

    if (!store) {
      return res.status(404).json({ error: "Store not found." });
    }

    res.json(store);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. DELETE /api/stores/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findByIdAndDelete(id);

    if (!store) {
      return res.status(404).json({ error: "Store not found." });
    }

    // Clean up all related documents for this store slug
    const slug = store.slug;
    const Product = require('../models/Product');
    const Order = require('../models/Order');
    const Staff = require('../models/Staff');
    const Customer = require('../models/Customer');

    await Promise.all([
      Product.deleteMany({ storeSlug: slug }),
      Order.deleteMany({ storeSlug: slug }),
      Staff.deleteMany({ storeSlug: slug }),
      Customer.deleteMany({ storeSlug: slug })
    ]);

    res.json({ message: "Store and all associated data deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. PUT /api/stores/:slug
router.put('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase().trim();
    const { 
      name, email, ownerName, tagline, subscriptionPlan, softwareType, logoUrl, faviconUrl,
      phone, whatsappNumber, address, location, language, customDomain, isLive, isTestingMode, newOrderAlerts,
      soundAlertsEnabled, vibrationAlertsEnabled,
      bankAccountHolder, bankName, bankAccountNumber, bankIfsc, upiId,
      codEnabled, deliveryFee, selfPickup
    } = req.body;

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email;
    if (ownerName !== undefined) updateFields.ownerName = ownerName;
    if (tagline !== undefined) updateFields.tagline = tagline;
    if (subscriptionPlan !== undefined) updateFields.subscriptionPlan = subscriptionPlan;
    if (softwareType !== undefined) updateFields.softwareType = softwareType;
    if (logoUrl !== undefined) updateFields.logoUrl = logoUrl;
    if (faviconUrl !== undefined) updateFields.faviconUrl = faviconUrl;
    if (phone !== undefined) updateFields.phone = phone;
    if (whatsappNumber !== undefined) updateFields.whatsappNumber = whatsappNumber;
    if (address !== undefined) updateFields.address = address;
    if (location !== undefined) updateFields.location = location;
    if (language !== undefined) updateFields.language = language;
    if (customDomain !== undefined) updateFields.customDomain = customDomain;
    if (isLive !== undefined) updateFields.isLive = isLive;
    if (isTestingMode !== undefined) updateFields.isTestingMode = isTestingMode;
    if (newOrderAlerts !== undefined) updateFields.newOrderAlerts = newOrderAlerts;
    if (soundAlertsEnabled !== undefined) updateFields.soundAlertsEnabled = soundAlertsEnabled;
    if (vibrationAlertsEnabled !== undefined) updateFields.vibrationAlertsEnabled = vibrationAlertsEnabled;
    if (bankAccountHolder !== undefined) updateFields.bankAccountHolder = bankAccountHolder;
    if (bankName !== undefined) updateFields.bankName = bankName;
    if (bankAccountNumber !== undefined) updateFields.bankAccountNumber = bankAccountNumber;
    if (bankIfsc !== undefined) updateFields.bankIfsc = bankIfsc;
    if (upiId !== undefined) updateFields.upiId = upiId;
    if (codEnabled !== undefined) updateFields.codEnabled = codEnabled;
    if (deliveryFee !== undefined) updateFields.deliveryFee = deliveryFee;
    if (selfPickup !== undefined) updateFields.selfPickup = selfPickup;

    const store = await Store.findOneAndUpdate(
      { slug },
      updateFields,
      { new: true }
    ).select('-password');

    if (!store) {
      return res.status(404).json({ error: "Store not found." });
    }

    res.json(store);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;