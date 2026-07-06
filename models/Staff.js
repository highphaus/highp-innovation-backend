const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema({
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
  role: { 
    type: String, 
    required: true, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    trim: true 
  },
  phone: { 
    type: String, 
    trim: true 
  },
  status: { 
    type: String, 
    default: "active", 
    enum: ["active", "inactive"] 
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Staff', StaffSchema);
