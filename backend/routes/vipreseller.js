const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const path = require('path');
const Game = require('../models/Game');
const { requireAdmin } = require('../middleware/auth');

const VIP_API_ID = (process.env.VIP_RESELLER_API_ID || 'mmtzhRrG').trim();
const VIP_API_KEY = (process.env.VIP_RESELLER_API_KEY || 'NBiQGgdTGFNUmZdsmHMLq2j7pkOG4pdR68IEl0qDUz3rIUkhMpkV3851QZOPHetO').trim();
const PROXY_URL = process.env.VIP_RESELLER_PROXY || process.env.DIGIFLAZZ_PROXY || 'http://zjvnatap:ioo73nj265iy@45.38.107.97:6014';
const httpsAgent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

const CACHE_FILE = path.join(__dirname, '../vip_cache.json');
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes cache

const generateSign = () => {
    return crypto.createHash('md5').update(VIP_API_ID + VIP_API_KEY).digest('hex');
};

// Persistent cache loader
let cachedServices = null;
try {
    if (fs.existsSync(CACHE_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (Array.isArray(parsed) && parsed.length > 0) {
            cachedServices = parsed;
        }
    }
} catch (e) {
    cachedServices = null;
}
let lastFetchTime = Array.isArray(cachedServices) ? Date.now() : 0;

// Fetch all game services from VIP Reseller
const fetchFromVipReseller = async () => {
    if (!VIP_API_ID || !VIP_API_KEY) {
        if (cachedServices) return cachedServices;
        throw new Error("VIP Reseller API credentials are missing in .env");
    }

    try {
        const sign = generateSign();
        const params = new URLSearchParams();
        params.append('key', VIP_API_KEY);
        params.append('sign', sign);
        params.append('type', 'services');

        const response = await axios.post('https://vip-reseller.co.id/api/game-feature', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            httpsAgent,
            timeout: 25000
        });

        const data = response.data?.data;
        if (response.data?.result && Array.isArray(data) && data.length > 0) {
            cachedServices = data;
            lastFetchTime = Date.now();
            try {
                fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
            } catch (e) {}
            return cachedServices;
        }

        if (cachedServices) {
            console.warn('[VIP Reseller] Empty or throttled response, serving cached services');
            return cachedServices;
        }

        throw new Error(response.data?.message || 'Failed to fetch services from VIP Reseller');
    } catch (err) {
        if (cachedServices) {
            console.warn('[VIP Reseller] Request failed, serving fallback cache:', err.message);
            return cachedServices;
        }
        throw err;
    }
};

// Safe service loader
const getServices = async (force = false) => {
    const now = Date.now();
    if (!cachedServices) {
        try {
            if (fs.existsSync(CACHE_FILE)) {
                const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
                if (Array.isArray(parsed) && parsed.length > 0) {
                    cachedServices = parsed;
                }
            }
        } catch (e) {}
    }

    if (force || !cachedServices || (now - lastFetchTime > CACHE_DURATION)) {
        try {
            const fresh = await fetchFromVipReseller();
            if (Array.isArray(fresh) && fresh.length > 0) {
                cachedServices = fresh;
                lastFetchTime = now;
            }
        } catch (err) {
            console.warn('[VIP Reseller] Service fetch warning, using fallback cache:', err.message);
            if (!cachedServices || cachedServices.length === 0) {
                throw err;
            }
        }
    }

    return cachedServices || [];
};

// Live USD/IDR Exchange Rate Caching (Wise & Financial Feed)
let liveExchangeRate = null;
let lastRateFetch = 0;
const RATE_CACHE_DURATION = 3 * 60 * 1000;

const getLiveIdrRate = async () => {
    const now = Date.now();
    if (liveExchangeRate && (now - lastRateFetch < RATE_CACHE_DURATION)) {
        return liveExchangeRate;
    }

    const sources = [
        async () => {
            const r = await axios.get('https://wise.com/rates/history+live?source=USD&target=IDR&length=1&resolution=hourly&unit=day', {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 5000
            });
            const latest = r.data && Array.isArray(r.data) ? r.data[r.data.length - 1] : null;
            return latest ? parseFloat(latest.value) : null;
        },
        async () => {
            const r = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 4000 });
            return r.data?.rates?.IDR;
        },
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
                return liveExchangeRate;
            }
        } catch (e) {}
    }

    return parseFloat(process.env.IDR_TO_USD_RATE || 18053);
};

// GET /api/vipreseller/products
// Fetch and format products for a game
router.get('/products', async (req, res) => {
    try {
        const force = req.query.force === 'true';
        const rawServices = await getServices(force);
        const exchangeRate = await getLiveIdrRate();

        const requestedGame = (req.query.game || req.query.brand || 'Mobile Legends').trim();
        const searchNorm = requestedGame.toLowerCase();

        // Match services:
        // 1. Exact match on game name (e.g. 'Mobile Legends B')
        // 2. Starts with / includes game name
        let matched = rawServices.filter(s => s.game && s.game.toLowerCase() === searchNorm);
        
        if (matched.length === 0) {
            // Check for Mobile Legends alias
            if (searchNorm.includes('mobile legend') || searchNorm.includes('mlbb')) {
                matched = rawServices.filter(s => s.game === 'Mobile Legends B' || s.game === 'Mobile Legends (Global)' || s.game === 'Mobile Legends A');
            } else if (searchNorm.includes('free fire') || searchNorm === 'ff') {
                matched = rawServices.filter(s => s.game === 'Free Fire' || s.game === 'Free Fire Max');
            } else {
                matched = rawServices.filter(s => s.game && s.game.toLowerCase().includes(searchNorm));
            }
        }

        // If no filter matched, return all available or empty
        if (matched.length === 0 && requestedGame.toUpperCase() === 'ALL') {
            matched = rawServices;
        }

        // Filter out inactive if not force/all
        const formattedProducts = matched.map(item => {
            const idrPrice = (item.price && typeof item.price.basic === 'number') 
                ? item.price.basic 
                : (typeof item.price === 'number' ? item.price : 0);
            
            const usdPrice = parseFloat((idrPrice / exchangeRate).toFixed(2));

            return {
                product_name: item.name,
                buyer_sku_code: item.code,
                price_idr: idrPrice,
                price_usd: usdPrice,
                category: 'games',
                brand: item.game,
                game: item.game,
                type: item.server ? `Server ${item.server}` : 'GLOBAL',
                desc: item.description || '',
                seller_name: 'VIP Reseller',
                buyer_product_status: item.status === 'available',
                seller_product_status: true,
                status: item.status === 'available' ? 'Active' : 'Inactive',
                stock: item.status === 'available' ? 9999 : 0
            };
        });

        res.json({
            success: true,
            count: formattedProducts.length,
            game: requestedGame,
            exchange_rate: {
                pair: 'USD/IDR',
                rate: exchangeRate,
                source: 'live'
            },
            data: formattedProducts
        });
    } catch (error) {
        console.error("[VIP Reseller] Products Error:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to fetch products from VIP Reseller"
        });
    }
});

// Helper for game images & metadata
const getGameMeta = (gameName) => {
    const name = gameName.toLowerCase();
    if (name.includes('mobile legend')) {
        return {
            rapidApiId: 'mobile-legends',
            sampleImage: 'https://res.cloudinary.com/cqiocigr/image/upload/v1791781946/gametopup/v2cjgkslrnvsrr08k5q3.jpg',
            needsZoneId: true
        };
    }
    if (name.includes('free fire')) {
        return {
            rapidApiId: 'freefire',
            sampleImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
            needsZoneId: false
        };
    }
    if (name.includes('pubg')) {
        return {
            rapidApiId: 'pubg-mobile',
            sampleImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
            needsZoneId: false
        };
    }
    if (name.includes('genshin')) {
        return {
            rapidApiId: 'genshin-impact',
            sampleImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
            needsZoneId: true
        };
    }
    if (name.includes('valorant')) {
        return {
            rapidApiId: 'valorant',
            sampleImage: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=600&q=80',
            needsZoneId: false
        };
    }
    return {
        rapidApiId: 'mobile-legends',
        sampleImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
        needsZoneId: false
    };
};

// GET /api/vipreseller/games (Admin import list)
router.get('/games', requireAdmin, async (req, res) => {
    try {
        const services = await getServices();
        const gameMap = {};

        services.forEach(s => {
            const gameName = s.game;
            if (!gameName) return;

            if (!gameMap[gameName]) {
                const meta = getGameMeta(gameName);
                gameMap[gameName] = {
                    name: gameName,
                    game: gameName,
                    provider: 'vipreseller',
                    category: 'games',
                    rapidApiId: meta.rapidApiId,
                    sampleImage: meta.sampleImage,
                    needsZoneId: meta.needsZoneId,
                    itemsCount: 0,
                    availableCount: 0
                };
            }

            gameMap[gameName].itemsCount++;
            if (s.status === 'available') {
                gameMap[gameName].availableCount++;
            }
        });

        const list = Object.values(gameMap).sort((a, b) => b.availableCount - a.availableCount);
        res.json({ success: true, count: list.length, games: list });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/vipreseller/balance - Check balance & profile
let vipBalanceCache = { data: null, timestamp: 0 };
const VIP_BALANCE_CACHE_TTL = 30 * 1000;

router.get('/balance', async (req, res) => {
    try {
        if (vipBalanceCache.data && (Date.now() - vipBalanceCache.timestamp < VIP_BALANCE_CACHE_TTL)) {
            return res.json(vipBalanceCache.data);
        }

        if (!VIP_API_ID || !VIP_API_KEY) {
            return res.json({
                success: false,
                balance: 0,
                balance_usd: 0,
                deposit: 0,
                message: 'VIP Reseller credentials missing'
            });
        }

        const exchangeRate = await getLiveIdrRate();
        const sign = generateSign();
        const params = new URLSearchParams();
        params.append('key', VIP_API_KEY);
        params.append('sign', sign);

        const response = await axios.post('https://vip-reseller.co.id/api/profile', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            httpsAgent,
            timeout: 10000
        });

        if (response.data && response.data.result && response.data.data) {
            const rawBalance = response.data.data.balance || 0;
            const balanceUsd = parseFloat((rawBalance / exchangeRate).toFixed(2));

            vipBalanceCache = {
                data: {
                    success: true,
                    deposit: rawBalance,
                    balance: balanceUsd,
                    balance_usd: balanceUsd,
                    balance_idr: rawBalance,
                    username: response.data.data.username,
                    full_name: response.data.data.full_name,
                    level: response.data.data.level,
                    rate: exchangeRate
                },
                timestamp: Date.now()
            };

            return res.json(vipBalanceCache.data);
        } else {
            return res.json({
                success: false,
                deposit: 0,
                balance: 0,
                balance_usd: 0,
                rate: exchangeRate,
                message: response.data?.message || 'Failed to fetch VIP Reseller balance'
            });
        }
    } catch (err) {
        console.error('[VIP Reseller] Balance check error:', err.response?.data || err.message);
        res.json({
            success: false,
            deposit: 0,
            balance: 0,
            balance_usd: 0,
            message: err.response?.data?.message || err.message
        });
    }
});

// Transaction Handler for Orders
const createVipResellerTransaction = async ({ service, customerNo, serverId, refId }) => {
    if (!VIP_API_ID || !VIP_API_KEY) throw new Error("VIP Reseller credentials missing in .env");

    const sign = generateSign();
    const params = new URLSearchParams();
    params.append('key', VIP_API_KEY);
    params.append('sign', sign);
    params.append('type', 'order');
    params.append('service', service);
    params.append('data_no', customerNo);
    if (serverId && serverId.trim() !== '') {
        params.append('data_zone', serverId);
    }

    const response = await axios.post('https://vip-reseller.co.id/api/game-feature', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        httpsAgent,
        timeout: 30000
    });

    if (response.data && response.data.result) {
        const orderData = response.data.data;
        return {
            status: (orderData?.status === 'success' || orderData?.status === 'sukses') ? 'Sukses' : (orderData?.status === 'error' ? 'Gagal' : 'Pending'),
            ref_id: orderData?.trxid || refId,
            message: response.data.message || 'VIP Reseller transaction placed successfully',
            data: orderData
        };
    } else {
        const errMessage = response.data?.message || 'VIP Reseller order rejected';
        const err = new Error(errMessage);
        err.response = { data: response.data };
        throw err;
    }
};

// Check transaction status
const checkVipResellerStatus = async ({ trxid }) => {
    const sign = generateSign();
    const params = new URLSearchParams();
    params.append('key', VIP_API_KEY);
    params.append('sign', sign);
    params.append('type', 'status');
    if (trxid) params.append('trxid', trxid);

    const response = await axios.post('https://vip-reseller.co.id/api/game-feature', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        httpsAgent,
        timeout: 15000
    });

    return response.data;
};

// POST /api/vipreseller/validate - Validate player ID and get In-Game Name
router.post('/validate', async (req, res) => {
    try {
        const { dbGameId, gameId, playerId, zoneId } = req.body;
        const targetId = dbGameId || gameId;

        let game = null;
        if (targetId && targetId.length === 24) {
            game = await Game.findById(targetId);
        }

        const gameSlug = game?.rapidApiId || 'mobile-legends';

        // 1. Try VIP Reseller get-nickname
        try {
            const sign = generateSign();
            const params = new URLSearchParams();
            params.append('key', VIP_API_KEY);
            params.append('sign', sign);
            params.append('type', 'get-nickname');
            params.append('code', gameSlug);
            params.append('target', playerId);
            if (zoneId) params.append('additional_target', zoneId);

            const vipNickRes = await axios.post('https://vip-reseller.co.id/api/game-feature', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                httpsAgent,
                timeout: 8000
            });

            if (vipNickRes.data?.result && vipNickRes.data?.data) {
                const nickname = typeof vipNickRes.data.data === 'string' 
                    ? vipNickRes.data.data 
                    : (vipNickRes.data.data.name || vipNickRes.data.data.username);
                
                if (nickname) {
                    return res.json({
                        status: true,
                        username: nickname,
                        message: 'Validated successfully via VIP Reseller'
                    });
                }
            }
        } catch (vipErr) {
            // Fallback to RapidAPI
        }

        // 2. Fallback to RapidAPI validator
        let rapidApiUrl = '';
        if (zoneId && zoneId.trim() !== '') {
            rapidApiUrl = `https://id-game-checker.p.rapidapi.com/${gameSlug}/${playerId}/${zoneId}`;
        } else {
            rapidApiUrl = `https://id-game-checker.p.rapidapi.com/${gameSlug}/${playerId}`;
        }

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
                username: rapidRes.data.data.username.replace('\x00', '').trim(),
                message: 'Validated successfully'
            });
        }

        return res.status(400).json({ error: 'Player ID or Zone ID not found in game database.' });
    } catch (error) {
        console.error("[VIP Reseller Validate] Error:", error.message);
        res.status(400).json({ error: 'Invalid Player ID or Server ID.' });
    }
});

router.createVipResellerTransaction = createVipResellerTransaction;
router.checkVipResellerStatus = checkVipResellerStatus;

module.exports = router;
