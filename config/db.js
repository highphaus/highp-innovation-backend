const mongoose = require('mongoose');

const connectDB = async () => {
  const primaryURI = process.env.MONGO_URI || process.env.DATABASE_URL;
  const fallbackURI = 'mongodb://127.0.0.1:27017/highp';

  if (!primaryURI) {
    console.error("❌ Corporate Cloud Setup Failure: Missing connection string inside .env");
    process.exit(1);
  }

  try {
    console.log('Connecting to Primary MongoDB Cluster...');
    await mongoose.connect(primaryURI, {
      serverSelectionTimeoutMS: 4000 // 4 seconds timeout
    });
    console.log('🚀 MNC Enterprise Gateway: Connected to MongoDB Multi-Tenant Cluster');
  } catch (err) {
    console.warn(`⚠️ Primary MongoDB Connection Failed: ${err.message}`);
    console.log('Falling back to local MongoDB instance...');
    try {
      await mongoose.connect(fallbackURI, {
        serverSelectionTimeoutMS: 3000
      });
      console.log('🚀 MNC Enterprise Gateway: Connected to Local MongoDB Instance successfully!');
    } catch (fallbackErr) {
      console.error('❌ Database Connection Crash: Both primary and local databases are unavailable.', fallbackErr.message);
      process.exit(1);
    }
  }
};

module.exports = connectDB;