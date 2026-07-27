require('dotenv').config();
const mongoose = require('mongoose');

async function wipeDatabase() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI missing from environment.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB Cluster to execute full wipe...");
  await mongoose.connect(uri);

  const collections = await mongoose.connection.db.collections();
  console.log(`Found ${collections.length} collections in database.`);

  for (let collection of collections) {
    const name = collection.collectionName;
    console.log(`Deleting all documents from collection: '${name}'...`);
    await collection.deleteMany({});
    console.log(`✓ Collection '${name}' is now empty.`);
  }

  console.log("\n🎉 DATABASE WIPED SUCCESSFULLY! All collections are 100% clean.");
  await mongoose.disconnect();
}

wipeDatabase().catch(console.error);
