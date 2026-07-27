require('dotenv').config();
const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({}, { strict: false });
const Store = mongoose.model('Store', storeSchema);

async function findTasteNPark() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const stores = await Store.find({
    $or: [
      { name: /taste/i },
      { slug: /taste/i },
      { name: /park/i },
      { slug: /park/i },
      { ownerName: /ramu/i },
      { slug: 'ramu' }
    ]
  });

  console.log('STORES MATCHING SEARCH:');
  console.log(JSON.stringify(stores, null, 2));

  await mongoose.disconnect();
}

findTasteNPark().catch(console.error);
