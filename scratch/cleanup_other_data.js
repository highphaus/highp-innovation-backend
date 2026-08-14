const mongoose = require('mongoose');
require('dotenv').config();

const Store = require('../models/Store');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Staff = require('../models/Staff');
const Campaign = require('../models/Campaign');
const Otp = require('../models/Otp');

async function cleanupData() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB Atlas.");

  const keepSlugs = ['tastenpark', 'taste-n-park'];

  // 1. Clean Stores
  const storeDel = await Store.deleteMany({ slug: { $nin: keepSlugs } });
  console.log(`🧹 Deleted ${storeDel.deletedCount} non-tastenpark Stores.`);

  // 2. Clean Products
  const prodDel = await Product.deleteMany({ storeSlug: { $nin: keepSlugs } });
  console.log(`🧹 Deleted ${prodDel.deletedCount} non-tastenpark Products.`);

  // 3. Clean Customers
  const custDel = await Customer.deleteMany({ storeSlug: { $nin: keepSlugs } });
  console.log(`🧹 Deleted ${custDel.deletedCount} non-tastenpark Customers.`);

  // 4. Clean Orders
  const orderDel = await Order.deleteMany({ storeSlug: { $nin: keepSlugs } });
  console.log(`🧹 Deleted ${orderDel.deletedCount} non-tastenpark Orders.`);

  // 5. Clean Staff
  const staffDel = await Staff.deleteMany({ storeSlug: { $nin: keepSlugs } });
  console.log(`🧹 Deleted ${staffDel.deletedCount} non-tastenpark Staff members.`);

  // 6. Clean Campaigns
  const campDel = await Campaign.deleteMany({ storeSlug: { $nin: keepSlugs } });
  console.log(`🧹 Deleted ${campDel.deletedCount} non-tastenpark Campaigns.`);

  // 7. Clean Test OTPs
  await Otp.deleteMany({});
  console.log(`🧹 Cleared temporary OTP collection.`);

  // Summary
  const remainingStores = await Store.find({}).lean();
  console.log(`\nRemaining Stores in Database (${remainingStores.length}):`);
  remainingStores.forEach(s => console.log(` - Store: "${s.name}" | Slug: "${s.slug}" | Email: "${s.email}"`));

  const remainingProducts = await Product.find({}).lean();
  console.log(`Remaining Products for Tastenpark: ${remainingProducts.length}`);
  remainingProducts.forEach(p => console.log(` - Item: "${p.name}" | Price: ₹${p.price}`));

  console.log("\n✨ DATABASE CLEANUP COMPLETE! ONLY TASTENPARK STORE & DATA REMAINS.");
  process.exit(0);
}

cleanupData();
