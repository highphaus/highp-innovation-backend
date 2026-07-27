require('dotenv').config();
const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({}, { strict: false });
const Store = mongoose.model('Store', storeSchema);

async function updateRamuStore() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Also update case variations just in case
  const updated = await Store.findOneAndUpdate(
    { $or: [{ slug: 'ramu' }, { name: /ramu/i }] },
    {
      $set: {
        name: 'Ramu Multi-Cuisine Restaurant & Mandi',
        ownerName: 'Ramu',
        tagline: 'Authentic Arabic Mandi, Biryani & Charcoal Delicacies',
        logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
        phone: '+91 98765 43210',
        whatsappNumber: '+91 98765 43210',
        address: 'Main Road, Kallara Town, Kerala',
        estimatedDeliveryTime: '25-35 Mins',
        minOrderAmount: 100,
        freeDeliveryAbove: 500,
        storeIsOpen: true,
        isLive: true
      }
    },
    { new: true }
  );

  console.log('UPDATED RAMU STORE RECORD IN MONGODB CLUSTER:');
  console.log(JSON.stringify(updated, null, 2));

  await mongoose.disconnect();
}

updateRamuStore().catch(console.error);
