require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const customerRoutes = require('./routes/customerRoutes');
const campaignRoutes = require('./routes/campaignRoutes');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Health Check Routes
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🚀 HighP Innovation Backend is running successfully!',
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    database: 'Connected'
  });
});

app.get('/api/test-email', async (req, res) => {
  const nodemailer = require('nodemailer');
  const targetEmail = req.query.email || 'highphaus@gmail.com';
  const pass = (process.env.SMTP_PASS || 'jvdshhpqzhgageqt').replace(/\s+/g, '');
  const user = (process.env.SMTP_USER || 'highphaus@gmail.com').trim();

  const results = {};

  // Test 587
  try {
    const t587 = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 5000
    });
    const info587 = await t587.sendMail({
      from: `"HighP Test" <${user}>`,
      to: targetEmail,
      subject: 'Test 587',
      text: 'Test 587'
    });
    results.port587 = { success: true, messageId: info587.messageId };
  } catch (err) {
    results.port587 = { success: false, error: err.message };
  }

  // Test 465
  try {
    const t465 = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 5000
    });
    const info465 = await t465.sendMail({
      from: `"HighP Test" <${user}>`,
      to: targetEmail,
      subject: 'Test 465',
      text: 'Test 465'
    });
    results.port465 = { success: true, messageId: info465.messageId };
  } catch (err) {
    results.port465 = { success: false, error: err.message };
  }

  res.json({
    env_user: user,
    env_pass_len: pass.length,
    results
  });
});

// API Routes (Support both /api/ prefix and direct / prefix)
app.use('/api/stores', storeRoutes);
app.use('/stores', storeRoutes);

app.use('/api/products', productRoutes);
app.use('/products', productRoutes);

app.use('/api/orders', orderRoutes);
app.use('/orders', orderRoutes);

app.use('/api/customers', customerRoutes);
app.use('/customers', customerRoutes);

app.use('/api/campaigns', campaignRoutes);
app.use('/campaigns', campaignRoutes);

app.use('/api/gsheets', require('./routes/googleSheetsRoutes'));
app.use('/gsheets', require('./routes/googleSheetsRoutes'));

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Gateway Server running seamlessly on port ${PORT}`);
  
  // Initialize background sheets worker
  const Store = require('./models/Store');
  const { syncStoreSheets } = require('./services/googleSheetsService');
  
  console.log("Background Sync Worker initialized. Checking sheets every 5 minutes.");
  setInterval(async () => {
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) return; // Skip if DB is reconnecting

      const activeAutoSyncStores = await Store.find({
        googleSheetId: { $ne: "" },
        googleSheetAutoSync: true
      }).lean();
      
      if (activeAutoSyncStores && activeAutoSyncStores.length > 0) {
        console.log(`Auto-Sync Worker: Launching batch syncs for ${activeAutoSyncStores.length} stores...`);
        for (const store of activeAutoSyncStores) {
          try {
            await syncStoreSheets(store.slug);
            console.log(`Auto-Sync Worker: Successfully synced ${store.slug}`);
          } catch (err) {
            console.error(`Auto-Sync Worker: Failed sync for ${store.slug}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.warn("Auto-Sync Worker Notice:", err.message || err);
    }
  }, 5 * 60 * 1000);
});