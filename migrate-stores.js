const mongoose = require('mongoose');
const Store = require('./models/Store');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/highp';

mongoose.connect(MONGO_URI)
  .then(async () => {
    const result = await Store.updateMany(
      { softwareType: { $exists: false } },
      { $set: { softwareType: 'restaurant' } }
    );
    console.log(`✅ Migrated ${result.modifiedCount} legacy stores → softwareType: 'restaurant'`);
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('❌ Migration failed:', err);
    mongoose.disconnect();
  });
