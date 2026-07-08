const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Store = require('../models/Store');

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
// REGISTER STORE
// POST /api/stores/register
// ==========================
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      slug,
      email,
      password,
      tagline,
      themeColor,
      softwareType,
      primaryColor: clientPrimary,
      bgColor: clientBg,
      hoverColor: clientHover,
      subscriptionPlan
    } = req.body;

    const formattedSlug = slug.toLowerCase().replace(/\s+/g, '-').trim();

    const existingStore = await Store.findOne({
      $or: [
        { slug: formattedSlug },
        { email: email.toLowerCase().trim() }
      ]
    });

    if (existingStore) {
      return res.status(400).json({
        message: "URL path or email address already occupied."
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let primaryColor = clientPrimary || "text-[#5C0E1E]";
    let bgColor = clientBg || "bg-[#5C0E1E]";
    let hoverColor = clientHover || "hover:bg-[#3F0712]";

    if (themeColor === "blue") {
      primaryColor = "text-blue-600";
      bgColor = "bg-blue-600";
      hoverColor = "hover:bg-blue-700";
    } else if (themeColor === "emerald") {
      primaryColor = "text-emerald-600";
      bgColor = "bg-emerald-600";
      hoverColor = "hover:bg-emerald-700";
    }

    const store = await Store.create({
      name,
      slug: formattedSlug,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      tagline,
      softwareType: softwareType || "restaurant",
      primaryColor,
      bgColor,
      hoverColor,
      isApproved: false,
      subscriptionPlan: subscriptionPlan || "basic"
    });

    const token = jwt.sign(
      {
        storeId: store._id,
        slug: store.slug
      },
      process.env.JWT_SECRET || "MNC_SUPER_SECRET_KEY",
      {
        expiresIn: "24h"
      }
    );

    res.status(201).json({
      token,
      slug: store.slug,
      isApproved: false
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message
    });
  }
});

// ==========================
// LOGIN
// POST /api/stores/login
// ==========================
router.post('/login', async (req, res) => {
  try {
    const { storeSlug, email, password, loginRole } = req.body;

    const slug = storeSlug.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();
    const roleType = loginRole || "admin";

    if (roleType === "admin") {
      const store = await Store.findOne({
        slug,
        email: cleanEmail
      });

      if (!store) {
        return res.status(404).json({
          message: "Store not found."
        });
      }

      const isMatch = await bcrypt.compare(password, store.password);

      if (!isMatch) {
        return res.status(401).json({
          message: "Invalid password."
        });
      }

      if (!store.isApproved) {
        return res.status(403).json({
          message: "Store is awaiting approval."
        });
      }

      const token = jwt.sign(
        {
          storeId: store._id,
          slug: store.slug,
          role: "admin"
        },
        process.env.JWT_SECRET || "MNC_SUPER_SECRET_KEY",
        {
          expiresIn: "24h"
        }
      );

      return res.json({
        token,
        role: "admin",
        slug: store.slug,
        name: store.name
      });
    }

    const Staff = require('../models/Staff');

    const staffMember = await Staff.findOne({
      storeSlug: slug,
      email: cleanEmail
    });

    if (!staffMember) {
      return res.status(404).json({
        message: "Staff member not found."
      });
    }

    const token = jwt.sign(
      {
        staffId: staffMember._id,
        slug,
        role: roleType
      },
      process.env.JWT_SECRET || "MNC_SUPER_SECRET_KEY",
      {
        expiresIn: "24h"
      }
    );

    res.json({
      token,
      role: roleType,
      slug,
      name: staffMember.name
    });

  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
});

module.exports = router;