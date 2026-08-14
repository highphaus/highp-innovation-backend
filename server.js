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

// Execute MongoDB connection immediately for Vercel serverless functions
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Guarantee MongoDB connection is active before processing API routes on Vercel
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB Connection Middleware Error:", err);
    res.status(500).json({ error: "Database Connection Failure" });
  }
});

// Health Check Routes
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🚀 HighP Innovation Backend is running successfully on Vercel!',
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    database: 'Connected'
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

// Export app for Vercel serverless functions
module.exports = app;

if (process.env.NODE_ENV !== 'production' || require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Gateway Server running seamlessly on port ${PORT}`);
    console.log("Environment Variables Check:", {
      mongo: !!process.env.MONGO_URI,
      emailUser: !!process.env.EMAIL_USER,
      emailPass: !!process.env.EMAIL_PASS
    });
  });
}