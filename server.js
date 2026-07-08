require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

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

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Gateway Server running seamlessly on port ${PORT}`);
});