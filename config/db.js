const mongoose = require('mongoose');
const dns = require('dns');

// Force IPv4 first to prevent DNS SRV lookup delays
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // If connection is already established, return existing connection instantly (0ms)
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (cached.conn) {
    return cached.conn;
  }

  const primaryURI = process.env.MONGO_URI || process.env.DATABASE_URL;
  if (!primaryURI) {
    console.error("❌ Corporate Cloud Setup Failure: Missing connection string inside .env");
    return null;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      maxPoolSize: 10
    };

    cached.promise = mongoose.connect(primaryURI, opts).then((m) => {
      console.log('🚀 MNC Enterprise Gateway: Connected to MongoDB Multi-Tenant Cluster');
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    console.error("⚠️ Primary MongoDB Connection Error:", err.message);
  }

  return cached.conn;
};

module.exports = connectDB;