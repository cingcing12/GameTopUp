const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  name: { type: String, required: true },
  publisher: { type: String, required: true },
  image: { type: String, required: true },
  banner: { type: String },
  currencyImage: { type: String, default: '💎' },
  provider: { type: String, default: 'moogold' },
  moogoldId: { type: String },
  denominations: [{
    amount: { type: Number, required: true },
    price: { type: Number, required: true },
    currencyName: { type: String, required: true }
  }],
  customPrices: {
    type: Map,
    of: Number,
    default: {}
  },
  featuredPackages: {
    type: [String],
    default: []
  },
  customImages: {
    type: Map,
    of: String,
    default: {}
  },
  rapidApiId: { 
    type: String, 
    default: 'mobile-legends',
    description: 'The slug used by RapidAPI to validate user IDs (e.g., mobile-legends, freefire)'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Game', gameSchema);
