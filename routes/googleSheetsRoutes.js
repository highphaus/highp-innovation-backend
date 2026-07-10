const express = require('express');
const router = express.Router();
const Store = require('../models/Store');
const { syncStoreSheets, resetStoreSheets } = require('../services/googleSheetsService');

// POST /api/gsheets/connect
router.post('/connect', async (req, res) => {
  try {
    const { storeSlug, googleSheetId } = req.body;
    if (!storeSlug || !googleSheetId) {
      return res.status(400).json({ error: "Missing required connection attributes." });
    }

    const store = await Store.findOne({ slug: storeSlug.toLowerCase().trim() });
    if (!store) return res.status(404).json({ error: "Store not found." });

    store.googleSheetId = googleSheetId.trim();
    store.googleSheetSyncStatus = "idle";
    await store.save();

    // Initial sync
    const syncResults = await syncStoreSheets(storeSlug);
    res.json({ message: "Google Sheet connected successfully.", syncResults });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gsheets/disconnect
router.post('/disconnect', async (req, res) => {
  try {
    const { storeSlug } = req.body;
    if (!storeSlug) return res.status(400).json({ error: "Missing store parameters." });

    const store = await Store.findOne({ slug: storeSlug.toLowerCase().trim() });
    if (!store) return res.status(404).json({ error: "Store not found." });

    store.googleSheetId = "";
    store.googleAccessToken = "";
    store.googleRefreshToken = "";
    store.googleTokenExpiry = null;
    store.googleSheetLastSync = null;
    store.googleSheetSyncStatus = "idle";
    store.googleSheetSyncMetrics = { imported: 0, updated: 0, errorsCount: 0, errorsList: [] };
    store.googleSheetAutoSync = false;
    await store.save();

    res.json({ message: "Google Sheet connection decoupled successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gsheets/sync
router.post('/sync', async (req, res) => {
  try {
    const { storeSlug } = req.body;
    if (!storeSlug) return res.status(400).json({ error: "Missing store parameters." });

    const results = await syncStoreSheets(storeSlug);
    res.json({ message: "Sync operation completed.", results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gsheets/reset
router.post('/reset', async (req, res) => {
  try {
    const { storeSlug } = req.body;
    if (!storeSlug) return res.status(400).json({ error: "Missing store parameters." });

    const results = await resetStoreSheets(storeSlug);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gsheets/status/:storeSlug
router.get('/status/:storeSlug', async (req, res) => {
  try {
    const store = await Store.findOne({ slug: req.params.storeSlug.toLowerCase().trim() });
    if (!store) return res.status(404).json({ error: "Store not found." });

    res.json({
      googleSheetId: store.googleSheetId,
      googleSheetLastSync: store.googleSheetLastSync,
      googleSheetSyncStatus: store.googleSheetSyncStatus,
      googleSheetSyncMetrics: store.googleSheetSyncMetrics || { imported: 0, updated: 0, errorsCount: 0, errorsList: [] },
      googleSheetAutoSync: store.googleSheetAutoSync
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gsheets/toggle-auto-sync
router.post('/toggle-auto-sync', async (req, res) => {
  try {
    const { storeSlug, enabled } = req.body;
    const store = await Store.findOne({ slug: storeSlug.toLowerCase().trim() });
    if (!store) return res.status(404).json({ error: "Store not found." });

    store.googleSheetAutoSync = !!enabled;
    await store.save();

    res.json({ message: `Auto sync state configured to ${store.googleSheetAutoSync}.`, autoSync: store.googleSheetAutoSync });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
