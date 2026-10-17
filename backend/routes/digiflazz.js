const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const Game = require('../models/Game');

const PROXY_URL = process.env.DIGIFLAZZ_PROXY || 'http://zjvnatap:ioo73nj265iy@45.38.107.97:6014';
const httpsAgent = new HttpsProxyAgent(PROXY_URL);

const fs = require('fs');
const path = require('path');
const CACHE_FILE = path.join(__dirname, '../digiflazz_cache.json');

// Persistent cache to prevent hitting Digiflazz rate limit (rc: 83)
let cachedProducts = null;
try {
    if (fs.existsSync(CACHE_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (Array.isArray(parsed)) {
            cachedProducts = parsed;
        }
    }
} catch (e) {
    cachedProducts = null;
}
let lastFetchTime = Array.isArray(cachedProducts) ? Date.now() : 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes cache

const fetchFromDigiflazz = async () => {
    const username = process.env.DIGIFLAZZ_USERNAME;
    const apiKey = process.env.DIGIFLAZZ_KEY;
    
    if (!username || !apiKey) {
        if (cachedProducts) return cachedProducts;
        throw new Error("Digiflazz API keys are missing in .env");
    }

    try {
        const signString = username + apiKey + "pricelist";
        const sign = crypto.createHash('md5').update(signString).digest('hex');

        const payload = {
            cmd: "prepaid",
            username: username,
            sign: sign
        };

        const response = await axios.post('https://api.digiflazz.com/v1/price-list', payload, {
            httpsAgent,
            timeout: 15000
        });

        const data = response.data?.data;

        if (Array.isArray(data) && data.length > 0) {
            cachedProducts = data;
            lastFetchTime = Date.now();
            try {
                fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
            } catch (e) {}
            return cachedProducts;
        }

        // Digiflazz rate limit rc: 83
        if (cachedProducts) {
            console.warn('Digiflazz rate limited or empty, serving cached products');
            return cachedProducts;
        }

        throw new Error(data?.message || 'Failed to fetch products');
    } catch (err) {
        if (cachedProducts) {
            console.warn('Digiflazz request failed, serving cached products:', err.message);
            return cachedProducts;
        }
        throw err;
    }
};

// Live USD/IDR Exchange Rate Caching (Wise & Google Finance Real-Time Live Feed)
let liveExchangeRate = null;
let lastRateFetch = 0;
const RATE_CACHE_DURATION = 3 * 60 * 1000; // 3 minutes cache for fresh real-time rates

const getLiveIdrRate = async () => {
    const now = Date.now();
    if (liveExchangeRate && (now - lastRateFetch < RATE_CACHE_DURATION)) {
        return liveExchangeRate;
    }

    const sources = [
        // 1. Primary: Wise Live Interbank Feed (1:1 identical to Wise app and Google Finance)
        async () => {
            const r = await axios.get('https://wise.com/rates/history+live?source=USD&target=IDR&length=1&resolution=hourly&unit=day', {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 5000
            });
            const latest = r.data && Array.isArray(r.data) ? r.data[r.data.length - 1] : null;
            return latest ? parseFloat(latest.value) : null;
        },
        // 2. Secondary: open.er-api.com
        async () => {
            const r = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 4000 });
            return r.data?.rates?.IDR;
        },
        // 3. Fallback: exchangerate-api.com
        async () => {
            const r = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 4000 });
            return r.data?.rates?.IDR;
        }
    ];

    for (const fetchSource of sources) {
        try {
            const rate = await fetchSource();
            if (rate && typeof rate === 'number' && rate > 10000) {
                liveExchangeRate = parseFloat(rate.toFixed(2));
                lastRateFetch = now;
                console.log(`[Digiflazz] Updated real-time Wise live rate: 1 USD = ${liveExchangeRate} IDR`);
                return liveExchangeRate;
            }
        } catch (e) {
            // Try next provider
        }
    }

    return parseFloat(process.env.IDR_TO_USD_RATE || 18053);
};

// Get products with optional brand filtering
router.get('/products', async (req, res) => {
    try {
        let products = cachedProducts;
        const now = Date.now();

        const force = req.query.force === 'true';

        if (force || !products || now - lastFetchTime > CACHE_DURATION) {
            try {
                products = await fetchFromDigiflazz();
            } catch (fetchErr) {
                if (!products) throw fetchErr;
                console.warn('Force fetch failed or rate limited, falling back to cache:', fetchErr.message);
            }
        }

        const brandQuery = (req.query.brand || 'MOBILE LEGENDS').toUpperCase();
        const typeQuery = req.query.type ? req.query.type.toUpperCase() : null;
        
        // Fetch live exchange rate
        const exchangeRate = await getLiveIdrRate();

        let filtered = products || [];
        if (brandQuery !== 'ALL') {
            filtered = filtered.filter(p => p.brand && p.brand.toUpperCase() === brandQuery);
        }
        if (typeQuery && typeQuery !== 'ALL') {
            filtered = filtered.filter(p => p.type && p.type.toUpperCase() === typeQuery);
        }

        const formattedProducts = filtered.map(product => ({
            product_name: product.product_name,
            buyer_sku_code: product.buyer_sku_code,
            price_idr: product.price,
            price_usd: parseFloat((product.price / exchangeRate).toFixed(2)),
            category: product.category,
            brand: product.brand,
            type: product.type,
            desc: product.desc,
            seller_name: product.seller_name,
            buyer_product_status: product.buyer_product_status,
            seller_product_status: product.seller_product_status,
            status: (product.buyer_product_status && product.seller_product_status) ? 'Active' : 'Inactive',
            stock: product.stock
        }));

        res.json({
            success: true,
            count: formattedProducts.length,
            brand: brandQuery,
            type: typeQuery || 'ALL',
            exchange_rate: {
                pair: 'USD/IDR',
                rate: exchangeRate,
                source: 'live'
            },
            data: formattedProducts
        });
    } catch (error) {
        console.error("Digiflazz Error:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to fetch from Digiflazz"
        });
    }
});

// Get all unique brands available
router.get('/brands', async (req, res) => {
    try {
        let products = cachedProducts;
        if (!products || Date.now() - lastFetchTime > CACHE_DURATION) {
            products = await fetchFromDigiflazz();
        }

        const brands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();
        res.json({ success: true, count: brands.length, brands });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get available Games for Admin Import
router.get('/games', async (req, res) => {
    try {
        let products = cachedProducts;
        if (!products || Date.now() - lastFetchTime > CACHE_DURATION) {
            products = await fetchFromDigiflazz();
        }

        const gameProducts = (products || []).filter(p => p.category && p.category.toLowerCase() === 'games');
        const brandMap = {};

        gameProducts.forEach(p => {
            const brand = p.brand;
            if (!brand) return;
            if (!brandMap[brand]) {
                const isML = brand.toUpperCase().includes('MOBILE');
                const isFF = brand.toUpperCase().includes('FREE FIRE');
                brandMap[brand] = {
                    brand: brand,
                    name: isML ? 'Mobile Legends: Bang Bang (Digiflazz)' : (isFF ? 'Free Fire (Digiflazz)' : brand),
                    category: p.category,
                    rapidApiId: isML ? 'mobile-legends' : (isFF ? 'freefire' : 'mobile-legends'),
                    sampleImage: isML 
                        ? 'https://res.cloudinary.com/cqiocigr/image/upload/v1791781946/gametopup/v2cjgkslrnvsrr08k5q3.jpg'
                        : 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
                    types: new Set(),
                    itemsCount: 0
                };
            }
            if (p.type) brandMap[brand].types.add(p.type);
            brandMap[brand].itemsCount++;
        });

        const list = Object.values(brandMap).map(b => ({
            ...b,
            types: Array.from(b.types)
        }));

        res.json({ success: true, count: list.length, games: list });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Top-up transaction handler
const createDigiflazzTransaction = async ({ buyerSkuCode, customerNo, refId }) => {
    const username = process.env.DIGIFLAZZ_USERNAME;
    const apiKey = process.env.DIGIFLAZZ_KEY;
    if (!username || !apiKey) throw new Error("Digiflazz credentials missing in .env");

    const sign = crypto.createHash('md5').update(username + apiKey + refId).digest('hex');
    const payload = {
        username,
        buyer_sku_code: buyerSkuCode,
        customer_no: customerNo,
        ref_id: refId,
        sign
    };

    const response = await axios.post('https://api.digiflazz.com/v1/transaction', payload, {
        httpsAgent,
        timeout: 25000
    });

    return response.data?.data;
};

// POST /api/digiflazz/topup
router.post('/topup', async (req, res) => {
    try {
        const { buyerSkuCode, customerNo, refId } = req.body;
        if (!buyerSkuCode || !customerNo) {
            return res.status(400).json({ success: false, error: "buyerSkuCode and customerNo are required" });
        }
        const generatedRefId = refId || ('TRX-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
        const result = await createDigiflazzTransaction({ buyerSkuCode, customerNo, refId: generatedRefId });
        res.json({ success: true, data: result });
    } catch (err) {
        console.error("Digiflazz Topup Error:", err.response?.data || err.message);
        res.status(500).json({ 
            success: false, 
            error: err.response?.data?.data?.message || err.response?.data?.message || err.message 
        });
    }
});

// GET /api/digiflazz/balance - Check balance (with 30s cache)
let digiBalanceCache = { data: null, timestamp: 0 };
const DIGI_BALANCE_CACHE_TTL = 30 * 1000;

router.get('/balance', async (req, res) => {
    try {
        if (digiBalanceCache.data && (Date.now() - digiBalanceCache.timestamp < DIGI_BALANCE_CACHE_TTL)) {
            return res.json(digiBalanceCache.data);
        }

        const username = (process.env.DIGIFLAZZ_USERNAME || '').trim();
        const apiKey = (process.env.DIGIFLAZZ_KEY || '').trim();
        const exchangeRate = await getLiveIdrRate();

        if (!username || !apiKey) {
            return res.json({
                success: false,
                balance: 0,
                balance_usd: 0,
                deposit: 0,
                message: 'Digiflazz credentials missing'
            });
        }

        const sign = crypto.createHash('md5').update(username + apiKey + 'depo').digest('hex');
        try {
            const response = await axios.post('https://api.digiflazz.com/v1/cek-saldo', {
                cmd: 'deposit',
                username,
                sign
            }, {
                httpsAgent,
                timeout: 10000
            });

            const deposit = response.data?.data?.deposit;
            const rc = response.data?.data?.rc;

            if (typeof deposit === 'number' && (!rc || rc === '00' || rc === 0)) {
                const balanceUsd = parseFloat((deposit / exchangeRate).toFixed(2));
                digiBalanceCache = {
                    data: {
                        success: true,
                        deposit: deposit,
                        balance: balanceUsd,
                        balance_usd: balanceUsd,
                        rate: exchangeRate
                    },
                    timestamp: Date.now()
                };
                return res.json(digiBalanceCache.data);
            } else {
                const errMsg = response.data?.data?.message || 'Failed to verify provider deposit';
                console.warn('[Digiflazz Balance Warning]:', response.data?.data);
                return res.json({
                    success: false,
                    deposit: typeof deposit === 'number' ? deposit : 0,
                    balance: 0,
                    balance_usd: 0,
                    rate: exchangeRate,
                    message: errMsg
                });
            }
        } catch (apiErr) {
            const errData = apiErr.response?.data?.data || apiErr.response?.data;
            const deposit = typeof errData?.deposit === 'number' ? errData.deposit : 0;
            console.warn('Digiflazz cek-saldo check error:', errData || apiErr.message);
            return res.json({
                success: false,
                deposit: deposit,
                balance: 0,
                balance_usd: 0,
                rate: exchangeRate,
                message: errData?.message || apiErr.message || 'Provider balance check failed'
            });
        }
    } catch (error) {
        res.json({
            success: false,
            balance: 0,
            balance_usd: 0,
            deposit: 0,
            message: error.message
        });
    }
});

// POST /api/digiflazz/validate - Validate player ID and get In-Game Name via RapidAPI
router.post('/validate', async (req, res) => {
    try {
        const { dbGameId, gameId, playerId, zoneId } = req.body;
        const targetId = dbGameId || gameId;
        
        let game = null;
        if (targetId && targetId.length === 24) {
            game = await Game.findById(targetId);
        }
        
        const gameSlug = game?.rapidApiId || 'mobile-legends'; // Default fallback

        // Build the correct RapidAPI URL
        let rapidApiUrl = '';
        if (zoneId && zoneId.trim() !== '') {
            rapidApiUrl = `https://id-game-checker.p.rapidapi.com/${gameSlug}/${playerId}/${zoneId}`;
        } else {
            rapidApiUrl = `https://id-game-checker.p.rapidapi.com/${gameSlug}/${playerId}`;
        }

        try {
            console.log("[Digiflazz Validate] Checking RapidAPI:", rapidApiUrl);
            const rapidRes = await axios.get(rapidApiUrl, {
                headers: {
                    'x-rapidapi-host': 'id-game-checker.p.rapidapi.com',
                    'x-rapidapi-key': process.env.RAPIDAPI_KEY || '708c58c6a0msh5c0736167b339d0p1a6755jsnf20c439e7c9c'
                },
                timeout: 10000 
            });

            if (rapidRes.data && !rapidRes.data.error && rapidRes.data.data?.username) {
                return res.json({
                    status: true,
                    err_code: null,
                    username: rapidRes.data.data.username.replace('\x00', '').trim(),
                    message: 'Validated successfully'
                });
            }
            
            return res.status(400).json({ error: 'Player ID or Zone ID not found in game database.' });
        } catch (freeError) {
            console.error("RapidAPI Error:", freeError.response ? freeError.response.data : freeError.message);
            return res.status(400).json({ error: 'Invalid Player ID or Server ID.' });
        }
    } catch (error) {
        console.error("Server Error in validate:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.createDigiflazzTransaction = createDigiflazzTransaction;
router.router = router;

module.exports = router;


