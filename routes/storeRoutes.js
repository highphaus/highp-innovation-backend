const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Store = require('../models/Store');
const Staff = require('../models/Staff');
const Payout = require('../models/Payout');
const { sendOTP, verifyOTP } = require('../services/otpService');

// Helper for flexible slug matching (e.g. "tastenpark" <-> "taste-n-park")
const getNormalizedSlugQuery = (rawSlug) => {
  if (!rawSlug) return { slug: "" };
  const clean = rawSlug.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  if (!clean) return { slug: rawSlug };
  const pattern = clean.split("").join("[-_\\s]?");
  const regex = new RegExp(`^${pattern}$`, "i");
  return {
    $or: [
      { slug: rawSlug },
      { slug: regex },
      { name: regex }
    ]
  };
};

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
router.get('/:slug', async (req, res) => {
  try {
    const rawSlug = req.params.slug.toLowerCase().trim();
    const query = getNormalizedSlugQuery(rawSlug);
    const store = await Store.findOne(query).select('-password');

    if (!store) {
      return res.status(200).json({
        slug: rawSlug,
        name: rawSlug.charAt(0).toUpperCase() + rawSlug.slice(1),
        softwareType: "restaurant",
        isLive: true,
        storeIsOpen: true,
        codEnabled: true,
        deliveryFee: 40,
        gstTaxRate: 0,
        otherChargesAmount: 0,
        checkoutMode: "website"
      });
    }

    const storeObj = store.toObject ? store.toObject() : { ...store };
    if (!storeObj.gstTaxRate || Number(storeObj.gstTaxRate) === 5) {
      storeObj.gstTaxRate = 0;
    }

    res.status(200).json(storeObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// SEND OTP
// ==========================
// SEND OTP FOR STORE / ADMIN / STAFF LOGIN & REGISTRATION
// POST /api/stores/send-otp
// body: { email, purpose: 'register'|'login', storeName? }
// ==========================
router.post('/send-otp', async (req, res) => {
  try {
    const { email, purpose, storeName } = req.body;
    const cleanEmail = (email || "").toLowerCase().trim();

    if (!cleanEmail) return res.status(400).json({ message: "Email address is required." });

    let existingStore = null;

    if (purpose === 'register') {
      const existing = await Store.findOne({ email: cleanEmail }).lean();
      if (existing) {
        return res.status(400).json({ 
          alreadyRegistered: true, 
          message: "An account with this email already exists. Please Sign In." 
        });
      }
      if (!storeName || !storeName.trim()) {
        return res.status(400).json({ message: "Store name is required for registration." });
      }
    } else {
      existingStore = await Store.findOne({ email: cleanEmail }).lean();
      if (!existingStore) {
        // Also check if staff member exists with this email
        const staffMember = await Staff.findOne({ email: cleanEmail }).lean();
        if (!staffMember) {
          return res.status(404).json({ 
            notRegistered: true, 
            message: "No store account found with this email. Please register your store." 
          });
        }
      }
    }

    const sent = await sendOTP(cleanEmail, existingStore);
    if (!sent) {
      return res.status(500).json({ message: "Failed to send verification email. Please check your email address." });
    }

    res.json({ success: true, message: "Verification 6-digit OTP code sent to your email." });

  } catch (err) {
    console.error("Send OTP error:", err);
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
});

// ==========================
// REGISTER STORE (OTP-verified)
// POST /api/stores/register
// body: { name, email, password, otp }
// ==========================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, otp, softwareType } = req.body;
    const cleanEmail = (email || "").toLowerCase().trim();

    if (!name || !cleanEmail || !otp) {
      return res.status(400).json({ message: "Store name, email, and OTP are required." });
    }

    // Verify OTP
    const result = await verifyOTP(cleanEmail, otp);
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

    const hashedPassword = password && password.trim().length > 0 
      ? await bcrypt.hash(password.trim(), 10) 
      : await bcrypt.hash("123456", 10);

    const store = await Store.create({
      name: name.trim(),
      slug: finalSlug,
      email: cleanEmail,
      password: hashedPassword,
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
// LOGIN (OTP Verification Only - Passwordless)
// POST /api/stores/login
// body: { email, otp, storeSlug, loginRole }
// ==========================
router.post('/login', async (req, res) => {
  try {
    const { email, otp, storeSlug, loginRole } = req.body;
    const cleanEmail = (email || "").toLowerCase().trim();

    if (!cleanEmail || !otp) {
      return res.status(400).json({ message: "Email address and 6-digit OTP code are required." });
    }

    // 1. Verify 6-digit OTP code first
    const result = await verifyOTP(cleanEmail, otp.trim());
    if (!result.valid) {
      return res.status(400).json({ message: result.reason });
    }

    // 2. Check Store account
    const querySlug = storeSlug ? storeSlug.toLowerCase().trim() : null;
    let store = null;
    if (querySlug) {
      store = await Store.findOne({ slug: querySlug, email: cleanEmail }) || await Store.findOne({ email: cleanEmail });
    } else {
      store = await Store.findOne({ email: cleanEmail });
    }

    if (store) {
      const token = jwt.sign(
        { storeId: store._id, slug: store.slug, role: loginRole || "admin" },
        process.env.JWT_SECRET || "MNC_SUPER_SECRET_KEY",
        { expiresIn: "24h" }
      );

      return res.json({
        token,
        role: loginRole || "admin",
        slug: store.slug,
        name: store.name
      });
    }

    // 3. If no Store matched, check Staff model for the store
    const staffQuery = querySlug 
      ? { storeSlug: querySlug, email: cleanEmail }
      : { email: cleanEmail };

    const staffMember = await Staff.findOne(staffQuery);
    if (staffMember) {
      const token = jwt.sign(
        { staffId: staffMember._id, slug: staffMember.storeSlug, role: staffMember.role },
        process.env.JWT_SECRET || "MNC_SUPER_SECRET_KEY",
        { expiresIn: "24h" }
      );

      return res.json({
        token,
        role: staffMember.role,
        slug: staffMember.storeSlug,
        name: staffMember.name
      });
    }

    // 4. If neither Store nor Staff is found
    return res.status(404).json({ 
      notRegistered: true, 
      message: "No account found with this email. Click Register to create your account." 
    });

  } catch (err) {
    console.error("Store login error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// STAFF MANAGEMENT PORTAL GATEWAY ROUTES
// ==========================================
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
      bankAccountHolder, bankName, bankAccountNumber, bankIfsc, upiId, upiEnabled,
      codEnabled, deliveryFee, gstTaxRate, otherChargesAmount, otherChargesLabel, selfPickup, dineInEnabled,
      storeIsOpen, minOrderAmount, freeDeliveryAbove, estimatedDeliveryTime, businessHours,
      busyModeActive, busyModeDuration, busyModeEndTime, busyModeMessage,
      checkoutMode,
      customCategories
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
    if (upiEnabled !== undefined) updateFields.upiEnabled = upiEnabled;
    if (codEnabled !== undefined) updateFields.codEnabled = codEnabled;
    if (deliveryFee !== undefined) updateFields.deliveryFee = deliveryFee;
    if (gstTaxRate !== undefined && gstTaxRate !== null && !isNaN(Number(gstTaxRate))) {
      updateFields.gstTaxRate = Number(gstTaxRate);
    }
    if (otherChargesAmount !== undefined) updateFields.otherChargesAmount = Number(otherChargesAmount);
    if (otherChargesLabel !== undefined) updateFields.otherChargesLabel = otherChargesLabel;
    if (selfPickup !== undefined) updateFields.selfPickup = selfPickup;
    if (dineInEnabled !== undefined) updateFields.dineInEnabled = dineInEnabled;
    if (storeIsOpen !== undefined) updateFields.storeIsOpen = storeIsOpen;
    if (minOrderAmount !== undefined) updateFields.minOrderAmount = Number(minOrderAmount);
    if (freeDeliveryAbove !== undefined) updateFields.freeDeliveryAbove = Number(freeDeliveryAbove);
    if (estimatedDeliveryTime !== undefined) updateFields.estimatedDeliveryTime = estimatedDeliveryTime;
    if (businessHours !== undefined) updateFields.businessHours = businessHours;
    if (busyModeActive !== undefined) updateFields.busyModeActive = busyModeActive;
    if (busyModeDuration !== undefined) updateFields.busyModeDuration = busyModeDuration;
    if (busyModeEndTime !== undefined) updateFields.busyModeEndTime = busyModeEndTime;
    if (busyModeMessage !== undefined) updateFields.busyModeMessage = busyModeMessage;
    if (checkoutMode !== undefined) updateFields.checkoutMode = checkoutMode;
    if (customCategories !== undefined) updateFields.customCategories = customCategories;

    const rawSlug = req.params.slug.toLowerCase().trim();
    const storeQuery = getNormalizedSlugQuery(rawSlug);

    await Store.updateMany(storeQuery, { $set: updateFields });
    if (!updateFields.gstTaxRate || Number(updateFields.gstTaxRate) === 0) {
      await Store.updateMany({}, { $set: { gstTaxRate: 0 } });
    }

    let store = await Store.findOne(storeQuery).select('-password');

    if (!store) {
      store = await Store.create({
        slug: rawSlug,
        name: name || rawSlug.charAt(0).toUpperCase() + rawSlug.slice(1),
        email: email || `${rawSlug}@highp.in`,
        gstTaxRate: 0,
        ...updateFields
      });
    }

    res.json(store);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PAYOUT / WITHDRAWAL ENDPOINTS
// ==========================================

// GET /api/stores/:storeSlug/payouts
router.get('/:storeSlug/payouts', async (req, res) => {
  try {
    const slug = req.params.storeSlug.toLowerCase().trim();
    const payouts = await Payout.find({ storeSlug: slug }).sort({ createdAt: -1 });
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stores/:storeSlug/payouts
router.post('/:storeSlug/payouts', async (req, res) => {
  try {
    const slug = req.params.storeSlug.toLowerCase().trim();
    const { amount, accountHolder, bankName, accountNumber, ifscCode, upiId } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Invalid withdrawal amount specified." });
    }

    const holder = accountHolder || "Store Owner";
    const bank = bankName || (upiId ? "UPI Payment Rail" : "Bank Transfer");
    const accNo = accountNumber || upiId;
    const ifsc = ifscCode || (upiId ? "UPI" : "N/A");

    if (!accNo) {
      return res.status(400).json({ error: "Missing required banking or UPI details for withdrawal." });
    }

    const newPayout = await Payout.create({
      storeSlug: slug,
      amount: Number(amount),
      accountHolder: holder,
      bankName: bank,
      accountNumber: accNo,
      ifscCode: ifsc,
      status: 'pending'
    });

    res.status(201).json(newPayout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/stores/:storeSlug/payouts/:payoutId/status
router.patch('/:storeSlug/payouts/:payoutId/status', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: "Status field is required." });
    }

    const payout = await Payout.findByIdAndUpdate(
      payoutId,
      { status, processedAt: status === 'paid' || status === 'approved' ? new Date() : null },
      { new: true }
    );

    if (!payout) {
      return res.status(404).json({ error: "Payout record not found." });
    }

    res.json(payout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;