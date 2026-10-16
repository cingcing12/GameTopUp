const express = require('express');
const router = express.Router();
const { BakongKHQR, khqrData, IndividualInfo } = require('bakong-khqr');
const QRCode = require('qrcode');

const API_BASE = "https://lorndavid.online";

// Generate a Dynamic KHQR Code using lorndavid.online
router.post('/generate', async (req, res) => {
  const { amount, storeLabel } = req.body;

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid amount' });
  }

  const accountId = process.env.BAKONG_ACCOUNT || process.env.BAKONG_ID || "sokpheak_vong@bkrt";
  const merchantName = process.env.BAKONG_MERCHANT_NAME || "GameTopup";
  const parsedAmount = parseFloat(amount);
  const billNumber = `INV-${Date.now().toString().slice(-6)}`;

  // 1. Try lorndavid.online API first as requested
  try {
    const response = await fetch(`${API_BASE}/api/v1/khqr/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      },
      body: JSON.stringify({
        accountId: accountId,
        merchantName: merchantName,
        amount: parsedAmount,
        currency: "USD",
        billNumber: billNumber,
        storeLabel: storeLabel || "GameTopup"
      })
    });

    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // Cloudflare returned HTML (e.g. on Render datacenter IP)
      console.warn('lorndavid.online returned non-JSON HTML, falling back to local generator');
    }

    if (data && (data.qr || data.qrString) && data.md5) {
      return res.json({
        success: true,
        qrString: data.qr || data.qrString,
        qrImage: data.qrImage || data.qrDataUrl,
        md5: data.md5,
        amount: parsedAmount,
        expiresIn: '15 mins'
      });
    }
  } catch (error) {
    console.warn('lorndavid.online request error:', error.message);
  }

  // 2. If lorndavid.online is blocked by Cloudflare on the server, generate standard KHQR locally so user is NEVER blocked
  try {
    const khqr = new BakongKHQR();
    const individualInfo = new IndividualInfo(
      accountId,
      merchantName,
      'Phnom Penh',
      {
        currency: khqrData.currency.usd,
        amount: parsedAmount,
        billNumber: billNumber,
        storeLabel: storeLabel || 'GameTopup',
        terminalLabel: 'Web Checkout',
        expirationTimestamp: Date.now() + 15 * 60 * 1000 // 15 mins expiry
      }
    );
    const khqrResponse = khqr.generateIndividual(individualInfo);

    if (khqrResponse && khqrResponse.status && khqrResponse.status.code === 0 && khqrResponse.data) {
      const qrImage = await QRCode.toDataURL(khqrResponse.data.qr, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return res.json({
        success: true,
        qrString: khqrResponse.data.qr,
        qrImage: qrImage,
        md5: khqrResponse.data.md5,
        amount: parsedAmount,
        expiresIn: '15 mins'
      });
    }
  } catch (err) {
    console.error('Local KHQR fallback error:', err);
  }

  return res.status(500).json({ success: false, message: 'Failed to generate KHQR code' });
});

// Check Bakong Transaction via lorndavid.online
router.post('/check', async (req, res) => {
  const { md5 } = req.body;

  if (!md5) {
    return res.status(400).json({ success: false, message: 'MD5 hash is required' });
  }

  // 1. Primary check: lorndavid.online
  try {
    const response = await fetch(`${API_BASE}/api/v1/check/${md5}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      }
    });

    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = null;
    }

    if (data && (data.responseCode == 0 || data.errorCode == 0 || data.code == 0)) {
      const txStatus = data.data?.status || data.transactionStatus || data.data?.transactionStatus;
      if (!txStatus || txStatus.toString().toUpperCase() === 'SUCCESS') {
        return res.json({ success: true, message: 'Payment verified', data: data.data || data });
      }
    }
  } catch (error) {
    console.warn('lorndavid.online check error:', error.message);
  }

  // 2. Secondary check: NBC OpenAPI if token configured
  const token = process.env.BAKONG_TOKEN;
  if (token) {
    try {
      const nbcUrl = process.env.BAKONG_OPENAPI_URL || 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5';
      const response = await fetch(nbcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ md5 })
      });

      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = null;
      }

      if (data && (data.responseCode == 0 || data.errorCode == 0 || data.code == 0)) {
        const txStatus = data.data?.status || data.transactionStatus || data.data?.transactionStatus;
        if (!txStatus || txStatus.toString().toUpperCase() === 'SUCCESS') {
          return res.json({ success: true, message: 'Payment verified', data: data.data || data });
        }
      }
    } catch (err) {
      console.warn('NBC check error:', err.message);
    }
  }

  return res.json({ success: false, message: 'Payment not found or pending' });
});

module.exports = router;

