const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// 🛒 CUSTOMER GATEWAY: Submit a new dynamic cart checkout transaction
router.post('/', async (req, res) => {
  try {
    const { storeSlug, customerId, customerName, phone, address, items, totalAmount } = req.body;

    // Fail-safe validation checklist
    if (!storeSlug || !customerName || !items || items.length === 0 || !totalAmount) {
      return res.status(400).json({ message: "MNC Validation Failure: Missing mandatory checkout payloads." });
    }

    const order = await Order.create({ 
      storeSlug: storeSlug.toLowerCase().trim(), 
      customerId: customerId || null,
      customerName, 
      phone: phone || "",
      address: address || "",
      items, 
      totalAmount,
      status: 'pending' // Enforces the starting lifecycle tracking state
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 👑 MERCHANT & PANEL ACCESSORS: Fetch active live orders matching a tenant identity
router.get('/:slug', async (req, res) => {
  try {
    const { role } = req.query; // Optional query parameter: ?role=kitchen or ?role=delivery
    let queryConditions = { storeSlug: req.params.slug.toLowerCase().trim() };

    // 🌟 MNC Data Optimization Strategy: Only deliver records relevant to the active workforce view
    if (role === 'kitchen') {
      // Kitchen staff only needs to display screens active in production queues
      queryConditions.status = { $in: ['pending', 'preparing'] };
    } else if (role === 'delivery') {
      // Delivery agent hubs only display listings waiting for dispatch courier handoffs
      queryConditions.status = 'completed'; 
    }

    const orders = await Order.find(queryConditions).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🍳 🏍️ OPERATIONAL PATCH: Update order lifecycle state transitions dynamically
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    // Strict business rule configuration boundaries
    const validStatuses = ['pending', 'preparing', 'delivering', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `State Error: "${status}" is not a recognized operational phase.` });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.orderId,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Target order transaction record was not found in the cluster." });
    }

    res.json(updatedOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;