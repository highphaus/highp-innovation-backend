require('dotenv').config();
const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({}, { strict: false });
const Store = mongoose.model('Store', storeSchema);

async function cleanRamuStore() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const updated = await Store.findOneAndUpdate(
    { slug: 'ramu' },
    {
      $set: {
        name: 'Ramu',
        ownerName: 'Ramu',
        tagline: '',
        logoUrl: '',
        phone: '',
        whatsappNumber: '',
        address: '',
        estimatedDeliveryTime: '30-45 mins',
        minOrderAmount: 0,
        freeDeliveryAbove: 0,
        storeIsOpen: true,
        isLive: true
      }
    },
    { new: true }
  );

  console.log('RESET RAMU STORE TO AUTHENTIC STORE OWNER DATA:');
  console.log(JSON.stringify(updated, null, 2));

  await mongoose.disconnect();
}

cleanRamuStore().catch(console.error);
