const express = require('express');
const router = express.Router();
const { BakongKHQR, khqrData, MerchantInfo } = require('bakong-khqr');
const QRCode = require('qrcode');

// Generate a Dynamic KHQR Code for a specific amount
router.post('/generate', async (req, res) => {
  const { amount, storeLabel } = req.body;

  try {
    const optionalData = {
      currency: khqrData.currency.usd,
      amount: parseFloat(amount),
      storeLabel: storeLabel || 'Game Topup',
      terminalLabel: 'Web Checkout',
      expirationTimestamp: Date.now() + (15 * 60 * 1000) // 15 mins expiry
    };

    const merchantInfo = new MerchantInfo(
      process.env.BAKONG_ID || 'sokpheak_vong@bkrt',
      process.env.BAKONG_MERCHANT_NAME || 'Vong Sokpheak',
      'Phnom Penh',
      process.env.BAKONG_ACQUIRER_ID || '12345678', // e.g. ABA Acquiring ID
      process.env.BAKONG_MERCHANT_ID || 'MERCHANT123',
      optionalData
    );

    const khqr = new BakongKHQR();
    const response = khqr.generateMerchant(merchantInfo);

    if (response.status.code === 0 && response.data) {
      // Generate base64 image from the KHQR string
      const qrImage = await QRCode.toDataURL(response.data.qr);
      
      res.json({
        success: true,
        qrString: response.data.qr,
        qrImage: qrImage,
        md5: response.data.md5,
        amount: amount,
        expiresIn: '15 mins'
      });
    } else {
      res.status(400).json({ success: false, message: response.status.message });
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
    const token = process.env.BAKONG_TOKEN;
    const apiUrl = process.env.BAKONG_OPENAPI_URL || 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5';
    
    // Fallback for development if token is not set/valid, we can simulate success or error
    if (!token) {
        return res.status(400).json({ success: false, message: 'Bakong API Token not configured.' });
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ md5 })
    });

    const data = await response.json();
    
    // Log the exact response from Bakong to see what it's returning
    console.log('Bakong Check Response:', JSON.stringify(data));

    // Usually Bakong Open API returns { responseCode: 0, responseMessage: "Success", data: {...} }
    // We use loose equality (==) in case the API returns a string "0" instead of an integer 0
    if (data.responseCode == 0 || data.errorCode == 0 || data.code == 0) {
      // Some bank APIs return responseCode 0 for any successful API call, 
      // but the actual payment status is inside data.status
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
