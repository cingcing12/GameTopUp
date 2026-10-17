const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Game = require('../models/Game');
const { createDigiflazzTransaction } = require('./digiflazz');
const { authMiddleware, requireAuth } = require('../middleware/auth');

// Create a new transaction (top-up)
router.post('/', authMiddleware, async (req, res) => {
  const { gameId, playerId, serverId, amount, price, paymentMethod, productId } = req.body;

  try {
    const newTransaction = new Transaction({
      userId: req.user ? req.user.id : undefined,
      gameId,
      playerId,
      serverId,
      amount,
      price,
      paymentMethod,
      status: 'pending' // Initial status
    });

    const savedTransaction = await newTransaction.save();
    
    // Process transaction directly through Digiflazz
    try {
      const customerNo = serverId ? `${playerId}${serverId}` : playerId;
      const digiRes = await createDigiflazzTransaction({
        buyerSkuCode: productId,
        customerNo: customerNo,
        refId: savedTransaction._id.toString()
      });

      const status = digiRes?.status;
      if (status === 'Sukses' || status === 'Pending') {
        savedTransaction.status = status === 'Sukses' ? 'completed' : 'pending';
        savedTransaction.providerReference = digiRes?.ref_id || null;
        await savedTransaction.save();

        return res.status(201).json({
          message: 'Digiflazz transaction submitted successfully!',
          transaction: savedTransaction,
          providerResponse: digiRes
        });
      } else {
        savedTransaction.status = 'failed';
        savedTransaction.errorDetails = digiRes?.message || 'Digiflazz rejected the transaction';
        await savedTransaction.save();

        return res.status(400).json({
          message: digiRes?.message || 'Digiflazz rejected transaction',
          error: digiRes
        });
      }
    } catch (digiErr) {
      savedTransaction.status = 'failed';
      savedTransaction.errorDetails = digiErr.response?.data?.message || digiErr.message;
      await savedTransaction.save();

      return res.status(500).json({
        message: digiErr.response?.data?.data?.message || digiErr.response?.data?.message || 'Digiflazz transaction failed',
        error: digiErr.message,
        transaction: savedTransaction
      });
    }

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get transaction history (latest 50)
router.get('/', requireAuth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role !== 'admin') {
      filter.userId = req.user.id;
    } else if (req.query.userId) {
      filter.userId = req.query.userId;
    }
    
    const transactions = await Transaction.find(filter)
      .populate('gameId', 'name image publisher')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
