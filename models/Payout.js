const mongoose = require('mongoose');

const PayoutSchema = new mongoose.Schema({
  storeSlug: { type: String, required: true, index: true, lowercase: true, trim: true },
  amount: { type: Number, required: true },
  accountHolder: { type: String, required: true },
  bankName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifscCode: { type: String, required: true },
  status: { type: String, enum: ['Requested', 'Processing', 'Completed', 'Failed'], default: 'Requested' },
  requestedAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Payout', PayoutSchema);
