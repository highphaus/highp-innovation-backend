const mongoose = require('mongoose');
const Store = require('./models/Store');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/highp';

mongoose.connect(MONGO_URI)
  .then(async () => {
    // Approve all existing stores and set softwareType if missing
    const result = await Store.updateMany(
      {},
      { $set: { isApproved: true, softwareType: 'restaurant' } }
    );
    console.log(`✅ Approved and updated ${result.modifiedCount} legacy stores`);
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('❌ Migration failed:', err);
    mongoose.disconnect();
  });
