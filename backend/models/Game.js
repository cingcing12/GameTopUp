const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  name: { type: String, required: true },
  publisher: { type: String, required: true },
  image: { type: String, required: true },
  banner: { type: String },
  moogoldId: { type: String },
  denominations: [{
    amount: { type: Number, required: true }, // e.g., 100 Diamonds
    price: { type: Number, required: true },  // e.g., $1.99
    currencyName: { type: String, required: true } // e.g., 'Diamonds', 'UC'
  }],
  customPrices: {
    type: Map,
    of: Number,
    default: {}
  },
  rapidApiId: { 
    type: String, 
    default: 'mobile-legends',
    description: 'The slug used by RapidAPI to validate user IDs (e.g., mobile-legends, freefire)'
  }
}, { timestamps: true });

module.exports = mongoose.model('Game', gameSchema);
