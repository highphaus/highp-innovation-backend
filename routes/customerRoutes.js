const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Order = require('../models/Order');

const JWT_SECRET = process.env.JWT_SECRET || "MNC_SUPER_SECRET_KEY";

// JWT Authentication Middleware for Customers
const authenticateCustomer = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Access Denied: Missing Authorization Header" });
  }

  const token = authHeader.split(' ')[1];
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.customer = verified; // verified has { customerId, email, storeSlug }
    next();
  } catch (err) {
    res.status(403).json({ message: "Invalid or Expired Security Token" });
  }
};

const { sendOTP, verifyOTP } = require('../services/otpService');

// ==========================
// CUSTOMER SEND OTP
// POST /api/customers/send-otp
// ==========================
router.post('/send-otp', async (req, res) => {
  try {
    const { storeSlug, email, purpose, name } = req.body;
    const slug = (storeSlug || "").toLowerCase().trim();
    const cleanEmail = (email || "").toLowerCase().trim();

    if (!slug || !cleanEmail) {
      return res.status(400).json({ message: "Store slug and email are required." });
    }

    if (purpose === 'register') {
      const existing = await Customer.findOne({ storeSlug: slug, email: cleanEmail });
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists for this store." });
      }
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Name is required for registration." });
      }
    } else {
      const existing = await Customer.findOne({ storeSlug: slug, email: cleanEmail });
      if (!existing) {
        return res.status(404).json({ message: "No account found with this email for this store. Please register first." });
      }
    }

    await sendOTP(cleanEmail);
    res.json({ message: "OTP sent successfully. Check your email." });
  } catch (err) {
    console.error("Customer send-otp error:", err);
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
});

// ==========================
// CUSTOMER SIGN UP / REGISTER
// POST /api/customers/register
// ==========================
router.post('/register', async (req, res) => {
  try {
    const { storeSlug, name, email, otp, phone } = req.body;

    if (!storeSlug || !name || !email || !otp) {
      return res.status(400).json({ message: "Please fill all required customer credentials and OTP." });
    }

    const slug = storeSlug.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // Verify OTP
    const result = verifyOTP(cleanEmail, otp);
    if (!result.valid) {
      return res.status(400).json({ message: result.reason });
    }

    // Check duplicate
    const existing = await Customer.findOne({ storeSlug: slug, email: cleanEmail });
    if (existing) {
      return res.status(400).json({ message: "An account with this email already exists for this store." });
    }

    // Create customer profile with dummy random password placeholder
    const customer = await Customer.create({
      storeSlug: slug,
      name: name.trim(),
      email: cleanEmail,
      password: await bcrypt.hash(Math.random().toString(36), 10),
      phone: phone ? phone.trim() : ""
    });

    // Sign jwt token
    const token = jwt.sign(
      { customerId: customer._id, email: customer.email, storeSlug: slug },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================
// CUSTOMER LOGIN
// POST /api/customers/login
// ==========================
router.post('/login', async (req, res) => {
  try {
    const { storeSlug, email, otp } = req.body;

    if (!storeSlug || !email || !otp) {
      return res.status(400).json({ message: "Email, OTP, and store slug are required." });
    }

    const slug = storeSlug.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // Verify OTP
    const result = verifyOTP(cleanEmail, otp);
    if (!result.valid) {
      return res.status(400).json({ message: result.reason });
    }

    // Find customer for this tenant
    const customer = await Customer.findOne({ storeSlug: slug, email: cleanEmail });
    if (!customer) {
      return res.status(404).json({ message: "No customer account found with this email." });
    }

    // Sign jwt token
    const token = jwt.sign(
      { customerId: customer._id, email: customer.email, storeSlug: slug },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================
// CUSTOMER ORDER HISTORY
// GET /api/customers/orders
// ==========================
router.get('/orders', authenticateCustomer, async (req, res) => {
  try {
    const { customerId, storeSlug } = req.customer;

    // Fetch orders matching customerId and storeSlug, sorted by creation date
    const orders = await Order.find({
      customerId,
      storeSlug
    }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/customers/me
router.get('/me', authenticateCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.customerId).select('-password');
    if (!customer) return res.status(404).json({ message: "Customer profile not found." });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/customers/profile
router.put('/profile', authenticateCustomer, async (req, res) => {
  try {
    const { name, phone, address, addresses } = req.body;
    const updateObj = { name, phone };
    if (address !== undefined) updateObj.address = address;
    if (addresses !== undefined) updateObj.addresses = addresses;

    const customer = await Customer.findByIdAndUpdate(
      req.customer.customerId,
      updateObj,
      { new: true }
    ).select('-password');

    if (!customer) return res.status(404).json({ message: "Customer profile not found." });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
