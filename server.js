require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();

// 🛰️ GLOBAL MIDDLEWARE NODE HOOKS
app.use(cors());
app.use(express.json()); // 🔥 CRITICAL: Must sit above route declarations to read req.body payloads

// 🔀 API ENDPOINT ROUTING CONNECTIONS
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// MONGOOSE DB CONTEXT CONNECTION
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Gateway Server running seamlessly on port ${PORT}`));