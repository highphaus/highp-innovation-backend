const mongoose = require('mongoose');

const StoreSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true }, 
  password: { type: String, required: true }, 
  tagline: { type: String },
  logoUrl: { type: String, default: "" },
  faviconUrl: { type: String, default: "" },
  ownerName: { type: String, default: "" },
  phone: { type: String, default: "" },
  whatsappNumber: { type: String, default: "" },
  address: { type: String, default: "" },
  location: { type: String, default: "" },
  language: { type: String, default: "English" },
  customDomain: { type: String, default: "" },
  isLive: { type: Boolean, default: true },
  isTestingMode: { type: Boolean, default: false },
  newOrderAlerts: { type: Boolean, default: true },
  soundAlertsEnabled: { type: Boolean, default: true },
  vibrationAlertsEnabled: { type: Boolean, default: true },
  softwareType: { type: String, default: "restaurant" },
  primaryColor: { type: String, default: "text-red-600" },
  bgColor: { type: String, default: "bg-red-600" },
  hoverColor: { type: String, default: "hover:bg-red-700" },
  isApproved: { type: Boolean, default: false },
  subscriptionPlan: { type: String, default: "basic" },
  googleSheetId: { type: String, default: "" },
  googleAccessToken: { type: String, default: "" },
  googleRefreshToken: { type: String, default: "" },
  googleTokenExpiry: { type: Date },
  googleSheetLastSync: { type: Date },
  googleSheetSyncStatus: { type: String, default: "idle" }, // idle, syncing, success, failed
  googleSheetSyncMetrics: {
    imported: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    errorsCount: { type: Number, default: 0 },
    errorsList: { type: Array, default: [] }
  },
  googleSheetAutoSync: { type: Boolean, default: false },
  bankAccountHolder: { type: String, default: "" },
  bankName: { type: String, default: "" },
  bankAccountNumber: { type: String, default: "" },
  bankIfsc: { type: String, default: "" },
  upiId: { type: String, default: "" },
  codEnabled: { type: Boolean, default: true },
  deliveryFee: { type: Number, default: 40 },
  selfPickup: { type: Boolean, default: true },
  busyModeActive: { type: Boolean, default: false },
  busyModeDuration: { type: Number, default: 0 },
  busyModeEndTime: { type: Date },
  busyModeMessage: { type: String, default: "" },
  checkoutMode: { type: String, enum: ['website', 'whatsapp'], default: 'website' },
  customCategories: { type: [String], default: [] },
  // Restaurant operational fields
  storeIsOpen: { type: Boolean, default: true },
  minOrderAmount: { type: Number, default: 0 },
  freeDeliveryAbove: { type: Number, default: 0 },
  estimatedDeliveryTime: { type: String, default: "30-45 mins" },
  businessHours: {
    type: [{
      day: { type: String },       // "Monday", "Tuesday", etc.
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: "09:00" },
      closeTime: { type: String, default: "22:00" }
    }],
    default: [
      { day: "Monday",    isOpen: true, openTime: "09:00", closeTime: "22:00" },
      { day: "Tuesday",   isOpen: true, openTime: "09:00", closeTime: "22:00" },
      { day: "Wednesday", isOpen: true, openTime: "09:00", closeTime: "22:00" },
      { day: "Thursday",  isOpen: true, openTime: "09:00", closeTime: "22:00" },
      { day: "Friday",    isOpen: true, openTime: "09:00", closeTime: "22:00" },
      { day: "Saturday",  isOpen: true, openTime: "10:00", closeTime: "23:00" },
      { day: "Sunday",    isOpen: true, openTime: "10:00", closeTime: "23:00" }
    ]
  }

}, { timestamps: true });

module.exports = mongoose.model('Store', StoreSchema);