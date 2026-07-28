const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Automatically delete from MongoDB after 10 minutes (600 seconds)
  }
});

module.exports = mongoose.models.Otp || mongoose.model('Otp', otpSchema);
