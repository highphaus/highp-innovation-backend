require('dotenv').config();
const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({}, { strict: false });
const Store = mongoose.model('Store', storeSchema);

const productSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.model('Product', productSchema);

async function syncTasteNPark() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // 1. Update Taste N Park store document
  const store = await Store.findOneAndUpdate(
    { $or: [{ slug: 'taste-n-park' }, { name: /taste/i }] },
    {
      $set: {
        name: 'Taste N Park',
        slug: 'taste-n-park',
        ownerName: 'Shaji',
        isLive: true,
        storeIsOpen: true,
        checkoutMode: 'website'
      }
    },
    { new: true, upsert: true }
  );

  console.log('TASTE N PARK STORE DOCUMENT:');
  console.log(JSON.stringify(store, null, 2));

  // 2. Link existing products to storeSlug: 'taste-n-park'
  const updateProducts = await Product.updateMany(
    { $or: [{ storeSlug: 'ramu' }, { storeSlug: 'taste-n-park' }, { storeId: store._id }] },
    { $set: { storeSlug: 'taste-n-park', storeId: String(store._id) } }
  );

  console.log(`LINKED ${updateProducts.modifiedCount || 0} PRODUCTS TO STORE SLUG 'taste-n-park'`);

  // Verify products
  const products = await Product.find({ storeSlug: 'taste-n-park' });
  console.log(`FOUND ${products.length} PRODUCTS FOR 'taste-n-park':`);
  products.forEach(p => console.log(`- ${p.name} (₹${p.price}) [Slug: ${p.storeSlug}]`));

  await mongoose.disconnect();
}

syncTasteNPark().catch(console.error);
