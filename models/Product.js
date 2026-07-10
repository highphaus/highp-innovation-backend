const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  storeSlug: { 
    type: String, 
    required: true, 
    index: true,        // 🌟 Crucial MNC Upgrade: Creates an index for instant query speeds
    lowercase: true,    // Enforces consistency so 'ZamZam' and 'zamzam' don't cause bugs
    trim: true          // Wipes out accidental spaces typed by merchants during onboarding
  }, 
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  price: { 
    type: Number, 
    required: true,
    min: [0, 'Price cannot be negative'] // Protects clients from accidental pricing entry errors
  },
  description: { 
    type: String,
    trim: true 
  },
  image: { 
    type: String,
    required: true // Enforces high-quality visuals for enterprise brands
  },
  productId: { type: String, default: "" },
  category: { type: String, default: "" },
  brand: { type: String, default: "" },
  sku: { type: String, default: "" },
  unit: { type: String, default: "" },
  offerPrice: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  status: { type: String, default: "active" }, // active, inactive
  featured: { type: Boolean, default: false },
  tags: { type: [String], default: [] },
  weight: { type: String, default: "" },
  packageSize: { type: String, default: "" },
  flavor: { type: String, default: "" },
  origin: { type: String, default: "" },
  dietaryInfo: { type: String, default: "" },
  variants: [
    {
      variantLabel: { type: String, default: "" },
      unit: { type: String, default: "" },
      price: { type: Number, default: 0 },
      offerPrice: { type: Number, default: 0 },
      stock: { type: Number, default: 0 },
      sku: { type: String, default: "" }
    }
  ]
}, {
  timestamps: true // Automatically tracks createdAt/updatedAt for inventory auditing
});

module.exports = mongoose.model('Product', ProductSchema);