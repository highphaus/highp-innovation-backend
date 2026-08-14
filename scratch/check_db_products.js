const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('../models/Product');
const Store = require('../models/Store');

async function inspectDatabase() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  const stores = await Store.find({}).lean();
  console.log(`Total Stores in DB: ${stores.length}`);
  stores.forEach(s => console.log(` - Store Name: "${s.name}" | Slug: "${s.slug}"`));

  const products = await Product.find({}).lean();
  console.log(`\nTotal Products in DB: ${products.length}`);

  const storeProductCounts = {};
  products.forEach(p => {
    const slug = (p.storeSlug || "NO_SLUG").toLowerCase();
    storeProductCounts[slug] = (storeProductCounts[slug] || 0) + 1;
  });

  console.log("\nProducts per Store Slug:");
  console.log(storeProductCounts);

  process.exit(0);
}

inspectDatabase();
