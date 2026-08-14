const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('../models/Product');
const Store = require('../models/Store');

const defaultProducts = [
  {
    name: "Signature Butter Chicken",
    price: 349,
    offerPrice: 299,
    category: "Curries",
    description: "Rich creamy tomato gravy with tender grilled chicken pieces.",
    image: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80",
    isVeg: false,
    inStock: true,
    featured: true
  },
  {
    name: "Paneer Butter Masala",
    price: 299,
    offerPrice: 249,
    category: "Curries",
    description: "Fresh cottage cheese cooked in creamy tomato butter sauce.",
    image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80",
    isVeg: true,
    inStock: true,
    featured: true
  },
  {
    name: "Hyderabadi Dum Biryani",
    price: 329,
    offerPrice: 279,
    category: "Biryani",
    description: "Fragrant basmati rice layered with spiced marinated chicken and herbs.",
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
    isVeg: false,
    inStock: true,
    featured: true
  },
  {
    name: "Garlic Butter Naan (2 Pcs)",
    price: 89,
    offerPrice: 79,
    category: "Breads",
    description: "Tandoor baked soft flatbread topped with garlic butter and fresh coriander.",
    image: "https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=600&q=80",
    isVeg: true,
    inStock: true
  },
  {
    name: "Crispy Veg Spring Rolls",
    price: 199,
    offerPrice: 169,
    category: "Starters",
    description: "Golden fried rolls stuffed with crunchy vegetables and Asian herbs.",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",
    isVeg: true,
    inStock: true
  },
  {
    name: "Mango Lassi Special",
    price: 129,
    offerPrice: 99,
    category: "Beverages",
    description: "Chilled yogurt smoothie blended with ripe Alphonso mango pulp.",
    image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80",
    isVeg: true,
    inStock: true
  }
];

async function seedAllStores() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB Atlas.");

  const stores = await Store.find({}).lean();
  console.log(`Seeding products for ${stores.length} stores...`);

  for (const store of stores) {
    const slug = store.slug.toLowerCase().trim();
    const existingCount = await Product.countDocuments({
      $or: [
        { storeSlug: slug },
        { storeSlug: slug.replace(/[^a-z0-9]/g, "") }
      ]
    });

    if (existingCount === 0) {
      console.log(`Seeding 6 products for store: "${store.name}" (${slug})...`);
      const docsToInsert = defaultProducts.map(p => ({
        ...p,
        storeSlug: slug
      }));
      await Product.insertMany(docsToInsert);
    } else {
      console.log(`Store "${store.name}" (${slug}) already has ${existingCount} products.`);
    }
  }

  console.log("\n✅ ALL STORES SEEDED WITH REAL DB PRODUCTS SUCCESSFULLY!");
  process.exit(0);
}

seedAllStores();
