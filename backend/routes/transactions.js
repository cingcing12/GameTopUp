const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Game = require('../models/Game');
const { createMoogoldTransaction } = require('./moogold');
const { verifyBakongPayment } = require('./bakong');
const { authMiddleware, requireAuth } = require('../middleware/auth');

// Create a new transaction (top-up) [SECURED AGAINST FRAUD, PROBES & REPLAY ATTACKS]
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

    // 2. Strict Payment Verification (Stop fake checkout exploits & unauthorized payment methods)
    const normalizedPaymentMethod = (paymentMethod || '').toString().toLowerCase().trim();
    const isKhqr = normalizedPaymentMethod === 'khqr' || normalizedPaymentMethod === 'bakong';
    const isAdmin = req.user && req.user.role === 'admin';

    // Disallow arbitrary payment methods like 'cash', 'probe', etc. for public checkout
    if (!isAdmin && !isKhqr) {
      return res.status(400).json({ 
        message: 'Invalid or unsupported payment method. Only verified Bakong KHQR payments are accepted.' 
      });
    }

    let verifiedPaymentHash = undefined;

    if (!isAdmin) {
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
      const verification = await verifyBakongPayment(cleanMd5);
      const isPaid = typeof verification === 'object' ? verification.verified : !!verification;
      if (!isPaid) {
        return res.status(400).json({ message: 'Payment verification failed with Bakong' });
      }

      verifiedPaymentHash = cleanMd5;
      console.log(`[Bakong Verified] MD5: ${cleanMd5}, source: ${verification?.source || 'gateway'}`);
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

    // 4. Absolute Pre-requisite for Supplier Fulfillment: MUST be confirmed paid
    const isConfirmedPaid = isAdmin || !!verifiedPaymentHash;
    if (!isConfirmedPaid) {
      return res.status(400).json({ message: 'Payment verification is required before order fulfillment' });
    }

    const newTransaction = new Transaction({
      userId: req.user ? req.user.id : undefined,
      gameId,
      playerId: cleanPlayerId,
      serverId: cleanServerId,
      amount: parsedAmount,
      price: parsedPrice,
      paymentMethod: normalizedPaymentMethod || 'khqr',
      paymentReference: verifiedPaymentHash,
      paymentStatus: 'paid',
      deliveryStatus: 'pending',
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
      savedTransaction.deliveryStatus = isCompleted ? 'delivered' : 'sending';
      savedTransaction.paymentStatus = 'paid';
      savedTransaction.providerReference = mooRes.ref_id || savedTransaction._id.toString();
      await savedTransaction.save();

      return res.status(201).json({
        message: isCompleted 
          ? 'Transaction completed successfully!' 
          : 'Transaction placed! Diamonds are currently sending to player account.',
        transaction: savedTransaction,
        providerResponse: mooRes
      });
    } catch (providerErr) {
      savedTransaction.status = 'failed';
      savedTransaction.deliveryStatus = 'failed';
      savedTransaction.paymentStatus = 'paid'; // User money was paid, but delivery failed!
      const rawMsg = providerErr.response?.data?.err_message || providerErr.response?.data?.message || providerErr.message || 'Delivery failed';
      let cleanMsg = rawMsg.toString().replace(/moogold:\s*/gi, '').replace(/moogold\s*/gi, '').trim();
      if (cleanMsg.toLowerCase().includes('refunded')) cleanMsg = 'Delivery refunded';
      savedTransaction.errorDetails = cleanMsg;
      await savedTransaction.save();

      return res.status(400).json({
        message: 'Unable to deliver diamonds at this time. Please contact support.',
        error: cleanMsg
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
        let changed = false;
        if (orderInfo.status !== tx.status) {
          tx.status = orderInfo.status;
          changed = true;
        }
        if (orderInfo.status === 'completed' && tx.deliveryStatus !== 'delivered') {
          tx.deliveryStatus = 'delivered';
          changed = true;
        } else if (orderInfo.status === 'failed' && tx.deliveryStatus !== 'failed') {
          tx.deliveryStatus = 'failed';
          tx.errorDetails = orderInfo.order_status === 'refunded' ? 'Delivery refunded' : `Delivery ${orderInfo.order_status}`;
          changed = true;
        } else if (orderInfo.status === 'processing' && tx.deliveryStatus !== 'sending') {
          tx.deliveryStatus = 'sending';
          changed = true;
        }
        if (changed) {
          await tx.save();
        }
        return res.json({
          success: true,
          status: tx.status,
          paymentStatus: tx.paymentStatus || 'paid',
          deliveryStatus: tx.deliveryStatus || 'sending',
          order_status: orderInfo.order_status,
          transaction: tx
        });
      } catch (err) {
        console.warn(`[Sync] Status check error for #${tx._id}:`, err.message);
      }
    }

    res.json({ 
      success: true, 
      status: tx.status, 
      paymentStatus: tx.paymentStatus || 'paid',
      deliveryStatus: tx.deliveryStatus || (tx.status === 'completed' ? 'delivered' : tx.status === 'failed' ? 'failed' : 'pending'),
      transaction: tx 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update transaction status manually [ADMIN ONLY]
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    const { paymentStatus, deliveryStatus, status, errorDetails } = req.body;
    const tx = await Transaction.findById(req.params.id);
    if (!tx) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    if (paymentStatus) tx.paymentStatus = paymentStatus;
    if (deliveryStatus) tx.deliveryStatus = deliveryStatus;
    if (status) tx.status = status;
    if (errorDetails !== undefined) tx.errorDetails = errorDetails;
    await tx.save();
    res.json({ success: true, transaction: tx });
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
    
    // Normalize dual status for legacy records
    const normalized = transactions.map(t => {
      const doc = t.toObject ? t.toObject() : { ...t };
      if (!doc.paymentStatus) {
        doc.paymentStatus = (doc.status === 'completed' || doc.status === 'processing' || doc.status === 'failed') ? 'paid' : 'unpaid';
      }
      if (!doc.deliveryStatus) {
        doc.deliveryStatus = doc.status === 'completed' ? 'delivered' : doc.status === 'processing' ? 'sending' : doc.status === 'failed' ? 'failed' : 'pending';
      }
      return doc;
    });

    res.json(normalized);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
