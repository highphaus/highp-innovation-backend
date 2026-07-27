const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  storeSlug: { type: String, required: true, index: true, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, default: '' },
  type: { type: String, default: 'Broadcast' }, // Broadcast | Promo | Announcement
  status: { type: String, enum: ['active', 'paused', 'draft'], default: 'draft' },
  clicksCount: { type: Number, default: 0 },
  couponCode: { type: String, default: '' },
  redemptionsCount: { type: Number, default: 0 },
  scheduledAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Campaign', CampaignSchema);
