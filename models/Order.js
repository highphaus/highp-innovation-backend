const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  storeSlug: { type: String, required: true, index: true, lowercase: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
  customerName: { type: String, required: true, trim: true },
  phone: { type: String, default: "", trim: true },
  address: { type: String, default: "", trim: true },
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
  },
  estimatedPrepTime: { type: Number, default: 0 },
  scheduledDelivery: { type: Date },
  deliveryInstructions: { type: String, default: "" },
  checkoutType: { type: String, enum: ['website', 'whatsapp'], default: 'website' },
  paymentMethod: { type: String, enum: ['cod', 'upi'], default: 'cod' },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  paymentReference: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);