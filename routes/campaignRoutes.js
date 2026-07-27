const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');

// ==========================
// GET /api/campaigns/:storeSlug
// List all campaigns for a store
// ==========================
router.get('/:storeSlug', async (req, res) => {
  try {
    const slug = req.params.storeSlug.toLowerCase().trim();
    const campaigns = await Campaign.find({ storeSlug: slug }).sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// GET /api/campaigns/:storeSlug/stats
// Returns aggregate stats: sharesCount, activeCouponsCount, redemptionsCount
// ==========================
router.get('/:storeSlug/stats', async (req, res) => {
  try {
    const slug = req.params.storeSlug.toLowerCase().trim();
    const campaigns = await Campaign.find({ storeSlug: slug });

    const activeCouponsCount = campaigns.filter(
      c => c.status === 'active' && c.couponCode
    ).length;

    const redemptionsCount = campaigns.reduce(
      (sum, c) => sum + (c.redemptionsCount || 0), 0
    );

    const sharesCount = campaigns.reduce(
      (sum, c) => sum + (c.clicksCount || 0), 0
    );

    res.json({ sharesCount, activeCouponsCount, redemptionsCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// POST /api/campaigns/:storeSlug
// Create a new campaign
// ==========================
router.post('/:storeSlug', async (req, res) => {
  try {
    const slug = req.params.storeSlug.toLowerCase().trim();
    const { title, message, type, status, couponCode, scheduledAt } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Campaign title is required.' });
    }

    const campaign = await Campaign.create({
      storeSlug: slug,
      title: title.trim(),
      message: message || '',
      type: type || 'Broadcast',
      status: status || 'draft',
      couponCode: couponCode || '',
      scheduledAt: scheduledAt || null,
    });

    res.status(201).json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// PATCH /api/campaigns/:storeSlug/:id
// Update campaign fields (status, clicks, message, etc.)
// ==========================
router.patch('/:storeSlug/:id', async (req, res) => {
  try {
    const { storeSlug, id } = req.params;
    const slug = storeSlug.toLowerCase().trim();
    const { title, message, type, status, couponCode, scheduledAt, clicksCount, redemptionsCount } = req.body;

    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (message !== undefined) updateFields.message = message;
    if (type !== undefined) updateFields.type = type;
    if (status !== undefined) updateFields.status = status;
    if (couponCode !== undefined) updateFields.couponCode = couponCode;
    if (scheduledAt !== undefined) updateFields.scheduledAt = scheduledAt;
    if (clicksCount !== undefined) updateFields.clicksCount = clicksCount;
    if (redemptionsCount !== undefined) updateFields.redemptionsCount = redemptionsCount;

    const campaign = await Campaign.findOneAndUpdate(
      { _id: id, storeSlug: slug },
      { $set: updateFields },
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// DELETE /api/campaigns/:storeSlug/:id
// Delete a campaign
// ==========================
router.delete('/:storeSlug/:id', async (req, res) => {
  try {
    const { storeSlug, id } = req.params;
    const slug = storeSlug.toLowerCase().trim();

    const campaign = await Campaign.findOneAndDelete({ _id: id, storeSlug: slug });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    res.json({ message: 'Campaign deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
