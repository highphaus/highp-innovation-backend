require('dotenv').config();
const mongoose = require('mongoose');

async function fixNonVegProducts() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing in .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB successfully");

  const productSchema = new mongoose.Schema({}, { strict: false });
  const Product = mongoose.model('Product', productSchema);

  const nonVegKeywords = [
    "chicken", "mutton", "fish", "prawn", "egg", "beef", "pork", "meat", 
    "seafood", "wings", "kebab", "kabab", "tikka", "shawarma", "biryani", 
    "biriyani", "nuggets", "burger", "fry", "alfham", "al-faham", "shawaya"
  ];

  const products = await Product.find({});
  console.log(`Found ${products.length} products total in database.`);
  let nonVegCount = 0;
  let vegCount = 0;

  for (const p of products) {
    const name = (p.name || "").toLowerCase();
    const isMeat = nonVegKeywords.some(kw => name.includes(kw));
    if (isMeat) {
      p.vegNonVeg = "non-veg";
      p.isNonVeg = true;
      await p.save();
      nonVegCount++;
      console.log(`[NON-VEG 🔴] ${p.name} (ID: ${p._id})`);
    } else {
      p.vegNonVeg = "veg";
      p.isNonVeg = false;
      await p.save();
      vegCount++;
      console.log(`[VEG 🟩] ${p.name} (ID: ${p._id})`);
    }
  }

  console.log(`Database update complete! Non-Veg: ${nonVegCount}, Veg: ${vegCount}`);
  await mongoose.disconnect();
}

fixNonVegProducts().catch(console.error);
