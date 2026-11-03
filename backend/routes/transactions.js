const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Game = require('../models/Game');
const { createMoogoldTransaction } = require('./moogold');
const { verifyBakongPayment } = require('./bakong');
const { authMiddleware, requireAuth } = require('../middleware/auth');

// Create a new transaction (top-up) [SECURED AGAINST FRAUD & REPLAY ATTACKS]
router.post('/', authMiddleware, async (req, res) => {
  const { gameId, playerId, serverId, amount, price, paymentMethod, productId, md5 } = req.body;

  try {
    // 1. Basic Parameter Validation
    if (!gameId || !playerId || !productId || !price || isNaN(price) || parseFloat(price) <= 0) {
      return res.status(400).json({ message: 'Invalid or missing transaction parameters' });
    }

    const cleanPlayerId = (playerId || '').toString().trim().replace(/[^a-zA-Z0-9_\-\.\#]/g, '').slice(0, 30);
    const cleanServerId = (serverId || '').toString().trim().replace(/[^a-zA-Z0-9_\-\.\#]/g, '').slice(0, 20);
    const parsedPrice = parseFloat(price);
    const parsedAmount = parseInt(amount) || 1;

    if (!cleanPlayerId) {
      return res.status(400).json({ message: 'Valid Player ID is required' });
    }

    // 2. Strict Payment Verification (Stop fake checkout exploits)
    const isKhqr = paymentMethod === 'khqr' || paymentMethod === 'bakong';
    const isAdmin = req.user && req.user.role === 'admin';

    if (isKhqr && !isAdmin) {
      if (!md5 || typeof md5 !== 'string' || md5.trim().length < 16) {
        return res.status(400).json({ message: 'Payment verification token (MD5) is required' });
      }

      const cleanMd5 = md5.trim();

      // Prevent Replay Attacks: Check if this payment was already redeemed
      const existingTx = await Transaction.findOne({ paymentReference: cleanMd5 });
      if (existingTx) {
        return res.status(400).json({ message: 'This payment has already been redeemed' });
      }

      // Verify payment directly with payment gateway
      const isPaid = await verifyBakongPayment(cleanMd5);
      if (!isPaid) {
        return res.status(400).json({ message: 'Payment verification failed with Bakong' });
      }
    }

    // 3. Price Tampering Protection
    if (gameId && gameId.length === 24 && /^[0-9a-fA-F]{24}$/.test(gameId)) {
      const game = await Game.findById(gameId);
      if (!game || !game.isActive) {
        return res.status(400).json({ message: 'Game service is currently unavailable' });
      }
      if (game.customPrices) {
        const customPrice = game.customPrices.get 
          ? game.customPrices.get(productId.toString()) 
          : game.customPrices[productId.toString()];
        if (customPrice !== undefined && parsedPrice < (parseFloat(customPrice) - 0.05)) {
          return res.status(400).json({ message: 'Invalid price submitted' });
        }
      }
    }

    const newTransaction = new Transaction({
      userId: req.user ? req.user.id : undefined,
      gameId,
      playerId: cleanPlayerId,
      serverId: cleanServerId,
      amount: parsedAmount,
      price: parsedPrice,
      paymentMethod,
      paymentReference: (isKhqr && md5) ? md5.trim() : undefined,
      status: 'pending'
    });

    const savedTransaction = await newTransaction.save();

    // 4. Process transaction through MooGold
    try {
      const mooRes = await createMoogoldTransaction({
        productId,
        playerId: cleanPlayerId,
        serverId: cleanServerId,
        refId: savedTransaction._id.toString()
      });

      // Keep status as 'processing' (sending) if MooGold hasn't delivered diamonds yet
      const isCompleted = mooRes.order_status === 'completed' || mooRes.status === 'completed';
      savedTransaction.status = isCompleted ? 'completed' : 'processing';
      savedTransaction.providerReference = mooRes.ref_id || savedTransaction._id.toString();
      await savedTransaction.save();

      return res.status(201).json({
        message: isCompleted 
          ? 'MooGold transaction completed successfully!' 
          : 'MooGold transaction placed! Diamonds are currently sending to player account.',
        transaction: savedTransaction,
        providerResponse: mooRes
      });
    } catch (providerErr) {
      savedTransaction.status = 'failed';
      savedTransaction.errorDetails = providerErr.response?.data?.err_message || providerErr.response?.data?.message || providerErr.message;
      await savedTransaction.save();

      return res.status(400).json({
        message: providerErr.message || 'MooGold rejected the transaction',
        error: providerErr.response?.data || providerErr.message
      });
    }

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Check and sync status for a specific transaction
router.get('/:id/status', async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id).populate('gameId', 'name image');
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // If transaction is still processing and has MooGold reference, poll MooGold directly
    if (tx.status === 'processing' && tx.providerReference) {
      const { checkMoogoldOrderStatus } = require('./moogold');
      try {
        const orderInfo = await checkMoogoldOrderStatus(tx.providerReference);
        if (orderInfo.status !== tx.status) {
          tx.status = orderInfo.status;
          if (orderInfo.status === 'failed') {
            tx.errorDetails = `MooGold status: ${orderInfo.order_status}`;
          }
          await tx.save();
        }
        return res.json({
          success: true,
          status: tx.status,
          order_status: orderInfo.order_status,
          transaction: tx
        });
      } catch (err) {
        console.warn(`[Sync] Status check error for #${tx._id}:`, err.message);
      }
    }

    res.json({ success: true, status: tx.status, transaction: tx });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
