require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const customerRoutes = require('./routes/customerRoutes');

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

// API Routes
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/gsheets', require('./routes/googleSheetsRoutes'));

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
      const activeAutoSyncStores = await Store.find({
        googleSheetId: { $ne: "" },
        googleSheetAutoSync: true
      });
      if (activeAutoSyncStores.length > 0) {
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
      console.error("Auto-Sync Worker Critical Failure:", err);
    }
  }, 5 * 60 * 1000);
});