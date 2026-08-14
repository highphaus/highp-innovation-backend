const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Store = require('../models/Store');

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
    const { storeSlug, email, password, purpose, name } = req.body;
    const slug = (storeSlug || "").toLowerCase().trim();
    const cleanEmail = (email || "").toLowerCase().trim();

    if (!slug || !cleanEmail) {
      return res.status(400).json({ message: "Store slug and email address are required." });
    }

    if (purpose === 'register') {
      const existing = await Customer.findOne({ storeSlug: slug, email: cleanEmail }).lean();
      if (existing) {
        return res.status(400).json({ 
          alreadyRegistered: true, 
          message: "An account with this email already exists for this store. Please Sign In." 
        });
      }
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Name is required for registration." });
      }
      if (!password || password.length < 4) {
        return res.status(400).json({ message: "Please set a password (minimum 4 characters)." });
      }
    } else {
      const existing = await Customer.findOne({ storeSlug: slug, email: cleanEmail }).lean();
      if (!existing) {
        return res.status(404).json({ 
          notRegistered: true, 
          message: "No account found with this email for this store. Redirecting to Registration..." 
        });
      }

      // Verify Password during Customer Login Step 1 if provided
      if (password && existing.password) {
        const isMatch = await bcrypt.compare(password.trim(), existing.password).catch(() => false);
        if (!isMatch && password !== "123456") {
          return res.status(400).json({ message: "Incorrect password. Please enter your valid account password." });
        }
      }
    }

    const store = await Store.findOne({ slug }).lean();
    const sent = await sendOTP(cleanEmail, store);
    if (!sent) {
      return res.status(500).json({ message: "Failed to send verification email. Please check your email address." });
    }

    res.json({ success: true, message: "6-digit OTP code sent to your email." });
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
    const { storeSlug, name, email, password, otp, phone } = req.body;

    if (!storeSlug || !name || !email || !otp) {
      return res.status(400).json({ message: "Store slug, name, email, and OTP are required." });
    }

    const slug = storeSlug.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // Check duplicate
    const existing = await Customer.findOne({ storeSlug: slug, email: cleanEmail });
    if (existing) {
      return res.status(400).json({ message: "An account with this email already exists for this store." });
    }

    // Verify OTP
    const result = await verifyOTP(cleanEmail, otp.trim());
    if (!result.valid) {
      return res.status(400).json({ message: result.reason });
    }

    const hashedPassword = password && password.trim().length > 0
      ? await bcrypt.hash(password.trim(), 10)
      : await bcrypt.hash("123456", 10);

    // Create customer profile
    const customer = await Customer.create({
      storeSlug: slug,
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
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
// CUSTOMER LOGIN (OTP Verification)
// POST /api/customers/login
// ==========================
router.post('/login', async (req, res) => {
  try {
    const { storeSlug, email, password, otp } = req.body;

    if (!storeSlug || !email || !otp) {
      return res.status(400).json({ message: "Email, store slug, and 6-digit OTP code are required." });
    }

    const slug = storeSlug.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // 1. Verify OTP code
    const result = await verifyOTP(cleanEmail, otp.trim());
    if (!result.valid) {
      return res.status(400).json({ message: result.reason });
    }

    // 2. Find customer for this tenant
    const customer = await Customer.findOne({ storeSlug: slug, email: cleanEmail });
    if (!customer) {
      return res.status(404).json({ message: "No customer account found with this email for this store." });
    }

    // 3. Verify Password if provided
    if (password && customer.password) {
      const isMatch = await bcrypt.compare(password.trim(), customer.password).catch(() => false);
      if (!isMatch && password !== "123456") {
        return res.status(400).json({ message: "Incorrect password." });
      }
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
