const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || process.env.DATABASE_URL;
    if (!mongoURI) {
      console.error("❌ Corporate Cloud Setup Failure: Missing connection string inside .env");
      process.exit(1);
    }
    
    await mongoose.connect(mongoURI);
    console.log('🚀 MNC Enterprise Gateway: Connected to MongoDB Multi-Tenant Cluster');
  } catch (err) {
    console.error('❌ Database Initialization Crash:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;