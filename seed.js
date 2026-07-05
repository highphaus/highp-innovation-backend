require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');
const Store = require('./models/Store');

const dummyProducts = [
  {
    name: "Truffle Glazed Smash Burger",
    price: 349,
    description: "Double smashed wagyu patties, aged cheddar, caramelized onions, and house-made truffle aioli on a toasted brioche bun.",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80"
  },
  {
    name: "Smashed Avocado Toast",
    price: 249,
    description: "Artisanal sourdough toast topped with creamy Haas avocado, cherry tomatoes, microgreens, feta cheese, and a perfectly poached egg.",
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80"
  },
  {
    name: "Rosemary Sea Salt Truffle Fries",
    price: 189,
    description: "Crispy hand-cut golden fries tossed with fresh rosemary, parmesan cheese, truffle oil, and served with garlic aioli dip.",
    image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80"
  },
  {
    name: "Artisan Vanilla Iced Latte",
    price: 169,
    description: "Single-origin espresso blended with organic milk, pure Madagascar vanilla syrup, served over hand-carved ice.",
    image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80"
  },
  {
    name: "Pistachio Cheesecake Tart",
    price: 289,
    description: "Velvety baked cream cheese topped with luxury Sicilian pistachio paste, crushed nuts, and a sweet honey glaze.",
    image: "https://images.unsplash.com/photo-1508737027454-e6454ef45afd?w=600&auto=format&fit=crop&q=80"
  },
  {
    name: "Smoked Salmon & Dill Croissant",
    price: 299,
    description: "Flaky, buttery bakery croissant stuffed with premium smoked salmon, herbed cream cheese, fresh dill, and capers.",
    image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80"
  }
];

async function seed() {
  try {
    const mongoURI = process.env.MONGO_URI || process.env.DATABASE_URL;
    if (!mongoURI) {
      console.error("❌ Missing connection string inside .env");
      process.exit(1);
    }
    await mongoose.connect(mongoURI);
    console.log("🍃 Database connected for seeding.");

    // Delete existing products for tastenpark to avoid duplicates on seed
    await Product.deleteMany({ storeSlug: "tastenpark" });
    console.log("🧹 Cleared old products for 'tastenpark'.");

    // Insert new dummy products
    const productsToInsert = dummyProducts.map(p => ({
      ...p,
      storeSlug: "tastenpark"
    }));

    await Product.insertMany(productsToInsert);
    console.log("✅ Seeded 6 premium MNC-level products successfully!");

    mongoose.connection.close();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
