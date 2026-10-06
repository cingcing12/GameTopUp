const express = require('express');
const router = express.Router();
// We no longer need the local 'bakong-khqr' and 'qrcode' packages 
// since the API handles generation and image creation for us.

const API_BASE = "https://lorndavid.online";

// Generate a Dynamic KHQR Code for a specific amount
router.post('/generate', async (req, res) => {
  const { amount, storeLabel } = req.body;

  try {
    const response = await fetch(`${API_BASE}/api/v1/khqr/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: process.env.BAKONG_ID || "sokpheak_vong@bkrt",
        merchantName: process.env.BAKONG_MERCHANT_NAME || "GameTopup",
        amount: parseFloat(amount),
        currency: "USD",
        billNumber: `INV-${Date.now().toString().slice(-6)}`,
        storeLabel: storeLabel || "GameTopup"
      })
    });

    const data = await response.json();

    if (response.ok && data.qr && data.md5) {
      res.json({
        success: true,
        qrString: data.qr,
        qrImage: data.qrImage, // The API provides the base64 image directly
        md5: data.md5,
        amount: amount,
        expiresIn: '15 mins'
      });
    } else {
      res.status(400).json({ success: false, message: data.message || "Failed to generate QR" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Check Bakong Transaction via Open API
router.post('/check', async (req, res) => {
  const { md5 } = req.body;

  if (!md5) {
    return res.status(400).json({ success: false, message: 'MD5 hash is required' });
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/check/${md5}`);
    const data = await response.json();
    
    // Log the exact response from the new API to see what it's returning
    console.log('Lorndavid API Check Response:', JSON.stringify(data));

    // The new API returns responseCode: 0 for success
    if (data.responseCode == 0 || data.errorCode == 0 || data.code == 0) {
      // Just in case there is a nested transaction status check
      const txStatus = data.data?.status || data.transactionStatus || data.data?.transactionStatus;
      if (txStatus && txStatus.toString().toUpperCase() !== 'SUCCESS') {
        return res.json({ success: false, message: 'Payment not successful yet', status: txStatus, error: data });
      }

      return res.json({ success: true, message: 'Payment verified', data: data.data || data });
    } else {
      // Payment not found or not yet paid. 
      // Return 200 OK so we don't spam the browser console with 400 errors during polling.
      return res.json({ success: false, message: 'Payment not found or pending', error: data });
    }
  } catch (error) {
    console.error('Bakong Check Error:', error);
    // Even on server error, we return 200 to prevent polling console spam, but with success: false
    res.json({ success: false, message: error.message });
  }
});

module.exports = router;
