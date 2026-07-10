const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  storeSlug: {
    type: String,
    required: true,
    index: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  addresses: [
    {
      tag: { type: String, default: 'Home' }, // Home, Work, Other
      detail: { type: String, required: true },
      isDefault: { type: Boolean, default: false }
    }
  ]
}, { timestamps: true });

// Enforce unique email per store/tenant
CustomerSchema.index({ storeSlug: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Customer', CustomerSchema);
