const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { moogoldRequest } = require('./moogold');
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
    
    // Call MooGold API to process the order
    try {
        const moogoldPayload = {
            path: 'order/create_order',
            data: {
                category: 50, // 50 for Direct Top Up
                'product-id': req.body.productId, // This is the variation_id
                quantity: 1,
                'User ID': playerId,
                'Zone ID': serverId,
                'Server ID': serverId,
                'Server': serverId
            }
        };

        const moogoldResponse = await moogoldRequest('order/create_order', 'POST', moogoldPayload);
        
        // Check if successful
        if (moogoldResponse && (moogoldResponse.status === true || moogoldResponse.status === 'true' || moogoldResponse.status === 'processing' || moogoldResponse.status === 'success' || (moogoldResponse.message && moogoldResponse.message.toLowerCase().includes('success')))) {
             savedTransaction.status = 'completed';
             savedTransaction.providerReference = moogoldResponse.transaction_id || null;
             await savedTransaction.save();

             return res.status(201).json({ 
               message: 'Transaction processed successfully!', 
               transaction: savedTransaction,
               moogoldResponse
             });
        } else {
             savedTransaction.status = 'failed';
             savedTransaction.errorDetails = JSON.stringify(moogoldResponse);
             await savedTransaction.save();
             
             return res.status(400).json({
               message: moogoldResponse.err_message || moogoldResponse.message || 'MooGold rejected the transaction.',
               error: moogoldResponse
             });
        }
    } catch (moogoldError) {
        savedTransaction.status = 'failed';
        savedTransaction.errorDetails = moogoldError.message;
        await savedTransaction.save();
        
        res.status(500).json({ 
            message: 'Transaction failed at provider.', 
            error: moogoldError.message,
            transaction: savedTransaction
        });
    }

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get transaction history (latest 10)
router.get('/', requireAuth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role !== 'admin') {
      filter.userId = req.user.id;
    } else if (req.query.userId) {
      filter.userId = req.query.userId;
    }
    
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
