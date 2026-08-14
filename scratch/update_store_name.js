const mongoose = require('mongoose');
require('dotenv').config();

const Store = require('../models/Store');
const Product = require('../models/Product');

async function updateStoreNameToHighP() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB Atlas.");

  // Update all stores in DB to be named "HighP Store" or update Taste N Park
  const res = await Store.updateMany({}, { $set: { name: "HighP Store" } });
  console.log(`✅ Updated ${res.modifiedCount} store records to name "HighP Store".`);

  const updatedStores = await Store.find({}).lean();
  console.log("\nActive Stores in MongoDB:");
  updatedStores.forEach(s => console.log(` - Store ID: ${s._id} | Name: "${s.name}" | Slug: "${s.slug}"`));

  process.exit(0);
}

updateStoreNameToHighP();
