const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');

router.get('/products', async (req, res) => {
    try {
        const username = process.env.DIGIFLAZZ_USERNAME;
        const apiKey = process.env.DIGIFLAZZ_KEY; // For checking prices, you can use either Dev or Prod key
        
        if (!username || !apiKey) {
            return res.status(400).json({ success: false, error: "Digiflazz API keys are missing in .env" });
        }

        // Digiflazz signature rule for price list: md5(username + apikey + "pricelist")
        const signString = username + apiKey + "pricelist";
        const sign = crypto.createHash('md5').update(signString).digest('hex');

        const payload = {
            cmd: "prepaid",
            username: username,
            sign: sign
        };

        const response = await axios.post('https://api.digiflazz.com/v1/price-list', payload);
        
        const allProducts = response.data.data;
        
        // Filter specifically for Mobile Legends products
        const mlbbProducts = allProducts.filter(p => p.brand === "MOBILE LEGENDS");
        
        // Here we could convert IDR to USD based on live rate (e.g., 17891) before sending to frontend
        const exchangeRate = 17891; 
        
        const formattedProducts = mlbbProducts.map(product => ({
            product_name: product.product_name,
            buyer_sku_code: product.buyer_sku_code,
            price_idr: product.price,
            price_usd: parseFloat((product.price / exchangeRate).toFixed(2)),
            category: product.category,
            brand: product.brand,
            seller_name: product.seller_name,
            status: product.seller_product_status ? 'Active' : 'Inactive'
        }));

        res.json({ success: true, data: formattedProducts });
    } catch (error) {
        console.error("Digiflazz Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "Failed to fetch from Digiflazz", details: error.response ? error.response.data : error.message });
    }
});

module.exports = router;
