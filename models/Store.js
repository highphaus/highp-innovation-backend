const mongoose = require('mongoose');

const StoreSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true }, 
  password: { type: String, required: true }, 
  tagline: { type: String },
  softwareType: { type: String, default: "restaurant" },
  primaryColor: { type: String, default: "text-red-600" },
  bgColor: { type: String, default: "bg-red-600" },
  hoverColor: { type: String, default: "hover:bg-red-700" }
}, { timestamps: true });

module.exports = mongoose.model('Store', StoreSchema);