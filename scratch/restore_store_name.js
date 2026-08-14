const mongoose = require('mongoose');
require('dotenv').config();

const Store = require('../models/Store');

async function restoreStoreName() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB Atlas.");

  // Update store document for slug tastenpark to "Taste N Park"
  const res = await Store.updateOne(
    { slug: "tastenpark" },
    { $set: { name: "Taste N Park" } }
  );
  console.log(`✅ Updated Taste N Park store document (modifiedCount: ${res.modifiedCount}).`);

  const updatedStore = await Store.findOne({ slug: "tastenpark" }).lean();
  console.log(`\nStore Details in Database:`);
  console.log(` - ID: ${updatedStore._id}`);
  console.log(` - Store Name: "${updatedStore.name}"`);
  console.log(` - Slug: "${updatedStore.slug}"`);
  console.log(` - Email: "${updatedStore.email}"`);

  process.exit(0);
}

restoreStoreName();
