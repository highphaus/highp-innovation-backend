const mongoose = require('mongoose');
const dns = require('dns');

// Force IPv4 first to prevent DNS SRV hangs on Windows/cloud hosts
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const connectDB = async () => {
  const primaryURI = process.env.MONGO_URI || process.env.DATABASE_URL;
  const fallbackURI = 'mongodb://127.0.0.1:27017/highp';

  if (!primaryURI) {
    console.error("❌ Corporate Cloud Setup Failure: Missing connection string inside .env");
    return;
  }

  try {
    console.log('Connecting to Primary MongoDB Cluster...');
    await mongoose.connect(primaryURI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000
    });
    console.log('🚀 MNC Enterprise Gateway: Connected to MongoDB Multi-Tenant Cluster');
  } catch (err) {
    console.warn(`⚠️ Primary MongoDB Connection Failed: ${err.message}`);
    console.log('Falling back to local MongoDB instance...');
    try {
      await mongoose.connect(fallbackURI, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000
      });
      console.log('🚀 MNC Enterprise Gateway: Connected to Local MongoDB Instance successfully!');
    } catch (fallbackErr) {
      console.error('⚠️ Database Warning: Primary cloud & local DB connections temporarily unavailable.', fallbackErr.message);
      console.log('🔄 Retrying DB connection in 10 seconds...');
      setTimeout(() => connectDB(), 10000);
    }
  }
};

module.exports = connectDB;