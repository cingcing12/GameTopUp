const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // false for guest top-ups
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  playerId: { type: String, required: true }, // The user's ID in the actual game
  serverId: { type: String, required: false }, // Some games need server ID (like MLBB)
  amount: { type: Number, required: true }, // How much premium currency they bought
  price: { type: Number, required: true }, // How much they paid
  paymentMethod: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  providerReference: { type: String }, // Transaction ID / Order ID from MooGold
  paymentReference: { type: String, sparse: true, index: true }, // Payment hash (e.g. Bakong MD5) to prevent replay exploits
  errorDetails: { type: String } // Error details if failed
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
