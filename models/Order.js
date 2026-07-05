const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  storeSlug: { type: String, required: true, index: true, lowercase: true, trim: true },
  customerName: { type: String, required: true, trim: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      name: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true }
    }
  ],
  totalAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'preparing', 'completed', 'cancelled'], 
    default: 'pending' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);