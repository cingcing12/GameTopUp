const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const Game = require('../models/Game');

const BASE_URL = 'https://moogold.com/wp-json/v1/api';

router.get('/test-proxy', async (req, res) => {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    const proxyList = [
        'http://zjvnatap:ioo73nj265iy@31.59.20.176:6754',
        'http://zjvnatap:ioo73nj265iy@45.38.107.97:6014'
    ];
    try {
        const results = [];
        for (const proxy of proxyList) {
            const agent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', { httpsAgent: agent });
            results.push({ proxy, ip: response.data.ip });
        }
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to generate auth headers and make requests
const moogoldRequest = async (path, method = 'GET', payloadData = null) => {
    const partnerId = process.env.MOOGOLD_PARTNER_ID;
    const secret = process.env.MOOGOLD_SECRET;
    
    if (!partnerId || !secret) {
        throw new Error('MooGold API credentials not found in environment variables.');
    }

    // Unix timestamp in seconds
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    let payload = '';
    if (payloadData) {
        // Need to add path to payload as per some versions of MooGold API
        payloadData.path = path;
        payload = JSON.stringify(payloadData);
    }

    const stringToSign = `${payload}${timestamp}${path}`;
    
    const signature = crypto.createHmac('sha256', secret)
        .update(stringToSign)
        .digest('hex');
        
    const basicAuth = Buffer.from(`${partnerId}:${secret}`).toString('base64');
    
    const headers = {
        'Authorization': `Basic ${basicAuth}`,
        'auth': signature,
        'timestamp': timestamp,
        'Content-Type': 'application/json'
    };

    const { HttpsProxyAgent } = require('https-proxy-agent');

    // The two specific proxies we sent to Liz
    const proxyList = [
        'http://zjvnatap:ioo73nj265iy@31.59.20.176:6754',
        'http://zjvnatap:ioo73nj265iy@45.38.107.97:6014'
    ];
    
    // Pick one of the two proxies randomly to balance the load
    const selectedProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    const httpsAgent = new HttpsProxyAgent(selectedProxy);

    try {
        const response = await axios({
            method,
            url: `${BASE_URL}/${path}`,
            headers,
            data: payloadData,
            httpsAgent: httpsAgent
        });
        return response.data;
    } catch (error) {
        console.error('MooGold API Error:', error.response ? error.response.data : error.message);
        throw error;
    }
};

// GET /api/moogold/games - Get list of direct top-up games (Category 50)
router.get('/games', async (req, res) => {
    try {
        const data = await moogoldRequest('product/list_product', 'POST', {
            path: 'product/list_product',
            category_id: 50 // Direct top-up games
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const productCache = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// GET /api/moogold/products/:game_id - Get packages/variations for a specific game
router.get('/products/:game_id', async (req, res) => {
    try {
        const gameId = req.params.game_id;
        let data;

        // Check if data is in cache and still valid
        if (productCache[gameId] && productCache[gameId].timestamp > Date.now() - CACHE_TTL) {
            console.log(`Serving product ${gameId} from cache to avoid rate limit`);
            data = productCache[gameId].data;
        } else {
            console.log(`Fetching product ${gameId} from MooGold API...`);
            data = await moogoldRequest('product/product_detail', 'POST', {
                path: 'product/product_detail',
                product_id: parseInt(gameId)
            });

            // Store in cache
            productCache[gameId] = {
                data,
                timestamp: Date.now()
            };
        }

        // Apply custom prices if they exist
        try {
            const query = [{ moogoldId: gameId }];
            if (gameId.length === 24) query.push({ _id: gameId });
            const game = await Game.findOne({ $or: query });
            
            if (game && data && data.Variation) {
                const dataCopy = JSON.parse(JSON.stringify(data));
                dataCopy.Variation = dataCopy.Variation.map(variation => {
                    // Always include original_price
                    variation.original_price = variation.variation_price;

                    if (game.customPrices) {
                        const customPrice = game.customPrices.get(variation.variation_id.toString());
                        if (customPrice !== undefined) {
                            variation.variation_price = customPrice.toString();
                        }
                    }
                    return variation;
                });
                return res.json(dataCopy);
            }
        } catch (e) {
            console.error("Error applying custom prices:", e);
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/moogold/validate - Validate player ID and get In-Game Name
router.post('/validate', async (req, res) => {
    try {
        const { product_id, dbGameId, playerId, zoneId } = req.body;
        
        // 1. Fetch Game from Database to get its RapidAPI Slug
        let game = null;
        if (dbGameId) {
            game = await Game.findById(dbGameId);
        } else {
            game = await Game.findOne({ moogoldId: product_id });
        }
        
        const gameSlug = game?.rapidApiId || 'mobile-legends'; // Default fallback

        // 2. Build the correct RapidAPI URL
        let rapidApiUrl = '';
        if (zoneId && zoneId.trim() !== '') {
            rapidApiUrl = `https://id-game-checker.p.rapidapi.com/${gameSlug}/${playerId}/${zoneId}`;
        } else {
            rapidApiUrl = `https://id-game-checker.p.rapidapi.com/${gameSlug}/${playerId}`;
        }

        try {
            console.log("Checking RapidAPI:", rapidApiUrl);
            const rapidRes = await axios.get(rapidApiUrl, {
                headers: {
                    'x-rapidapi-host': 'id-game-checker.p.rapidapi.com',
                    'x-rapidapi-key': process.env.RAPIDAPI_KEY || '708c58c6a0msh5c0736167b339d0p1a6755jsnf20c439e7c9c'
                },
                timeout: 10000 
            });
            console.log("RapidAPI Response:", rapidRes.data);

            if (rapidRes.data && !rapidRes.data.error && rapidRes.data.data?.username) {
                return res.json({
                    status: true,
                    err_code: null,
                    username: rapidRes.data.data.username.replace('\x00', '').trim(),
                    message: 'Validated via RapidAPI'
                });
            }
            
            // The API is working fine, so if it's not found, it's truly invalid.
            return res.status(400).json({ error: 'Player ID or Zone ID not found in game database.' });
            
        } catch (freeError) {
            console.error("RapidAPI Axios Error:", freeError.response ? freeError.response.data : freeError.message);
            return res.status(400).json({ error: 'Invalid Player ID or Server ID.' });
        }

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/moogold/order - Create an order
router.post('/order', async (req, res) => {
    try {
        const { product_id, category_id, data } = req.body;
        
        const payload = {
            path: 'order/create_order',
            data: {
                category: category_id,
                'product-id': product_id,
                ...data // User ID, Zone ID etc depending on game
            }
        };

        const result = await moogoldRequest('order/create_order', 'POST', payload);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/moogold/order/:order_id - Get order details
router.get('/order/:order_id', async (req, res) => {
    try {
        const payload = {
            path: 'order/order_detail',
            order_id: req.params.order_id
        };
        const data = await moogoldRequest('order/order_detail', 'POST', payload);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/moogold/balance - Check balance
router.get('/balance', async (req, res) => {
    try {
        const payload = {
            path: 'user/balance'
        };
        const data = await moogoldRequest('user/balance', 'POST', payload);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = { router, moogoldRequest };
