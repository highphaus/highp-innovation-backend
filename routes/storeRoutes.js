const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Store = require('../models/Store');

// 🏢 PUBLIC: Fetch Profile (Maps to: GET http://localhost:5000/api/stores/:slug)
router.get('/:slug', async (req, res) => {
  try {
    const store = await Store.findOne({ slug: req.params.slug.toLowerCase().trim() }).select('-password');
    if (!store) return res.status(404).json({ message: "Tenant Profile Not Found" });
    res.json(store);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🚀 REGISTER: Create Store Account (Maps to: POST http://localhost:5000/api/stores/register)
// 🌟 NOTICE: The path is just '/register', NOT '/api/stores/register'
router.post('/register', async (req, res) => {
  try {
    const { name, slug, email, password, tagline, themeColor, softwareType, primaryColor: clientPrimary, bgColor: clientBg, hoverColor: clientHover } = req.body;
    const formattedSlug = slug.toLowerCase().replace(/\s+/g, '-').trim();

    const existingStore = await Store.findOne({ 
      $or: [{ slug: formattedSlug }, { email: email.toLowerCase().trim() }] 
    });
    
    if (existingStore) {
      return res.status(400).json({ message: "URL path or email address already occupied." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let primaryColor = clientPrimary || "text-[#5C0E1E]";
    let bgColor = clientBg || "bg-[#5C0E1E]";
    let hoverColor = clientHover || "hover:bg-[#3F0712]";

    if (themeColor === 'blue') { primaryColor = "text-blue-600"; bgColor = "bg-blue-600"; hoverColor = "hover:bg-blue-700"; }
    else if (themeColor === 'emerald') { primaryColor = "text-emerald-600"; bgColor = "bg-emerald-600"; hoverColor = "hover:bg-emerald-700"; }

    const store = await Store.create({ 
      name, 
      slug: formattedSlug, 
      email: email.toLowerCase().trim(), 
      password: hashedPassword, 
      tagline, 
      softwareType: softwareType || "restaurant",
      primaryColor, 
      bgColor, 
      hoverColor 
    });

    const token = jwt.sign(
      { storeId: store._id, slug: store.slug }, 
      process.env.JWT_SECRET || 'MNC_SUPER_SECRET_KEY', 
      { expiresIn: '24h' }
    );

    res.status(201).json({ token, slug: store.slug });
  } catch (err) {
    console.error("❌ Registration Pipeline Failure:", err);
    res.status(500).json({ message: err.message });
  }
});

// 🔐 LOGIN: Authenticate Store Admin (Maps to: POST http://localhost:5000/api/stores/login)
router.post('/login', async (req, res) => {
  try {
    const { storeSlug, email, password } = req.body;
    const store = await Store.findOne({ 
      slug: storeSlug.toLowerCase().trim(), 
      email: email.toLowerCase().trim() 
    });

    if (!store) return res.status(401).json({ message: "Invalid credentials. Store or account not found." });

    const isMatch = await bcrypt.compare(password, store.password);
    if (!isMatch) return res.status(401).json({ message: "Incorrect password. Access denied." });

    const token = jwt.sign(
      { storeId: store._id, slug: store.slug, role: 'admin' },
      process.env.JWT_SECRET || 'MNC_SUPER_SECRET_KEY',
      { expiresIn: '24h' }
    );

    res.json({ token, role: 'admin', slug: store.slug, name: store.name });
  } catch (err) {
    console.error("❌ Login Pipeline Failure:", err);
    res.status(500).json({ message: err.message });
  }
});

// 👥 STAFF: Get all staff members for a store
router.get('/:slug/staff', async (req, res) => {
  try {
    const Staff = require('../models/Staff');
    const staff = await Staff.find({ storeSlug: req.params.slug.toLowerCase().trim() });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 👥 STAFF: Create a new staff member
router.post('/:slug/staff', async (req, res) => {
  try {
    const Staff = require('../models/Staff');
    const { name, role, email, phone } = req.body;
    const member = await Staff.create({
      storeSlug: req.params.slug.toLowerCase().trim(),
      name,
      role,
      email,
      phone
    });
    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 👥 STAFF: Delete a staff member
router.delete('/:slug/staff/:id', async (req, res) => {
  try {
    const Staff = require('../models/Staff');
    await Staff.findByIdAndDelete(req.params.id);
    res.json({ message: "Staff member deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;