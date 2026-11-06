const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const Game = require('../models/Game');
const { requireAdmin, requireAuth, authMiddleware } = require('../middleware/auth');

const BASE_URL = 'https://moogold.com/wp-json/v1/api';

// Permanent Static Dedicated Proxies (whitelisted with MooGold: 45.38.107.97 and 31.59.20.176)
const STATIC_PROXIES = [
    process.env.MOOGOLD_PROXY,
    'http://zjvnatap:ioo73nj265iy@45.38.107.97:6014',
    'http://zjvnatap:ioo73nj265iy@31.59.20.176:6754'
].filter(Boolean);

let activeProxyIndex = 0;

// Safe sanitization helper against injections & path traversals
const sanitizeInput = (val, maxLen = 35) => {
    if (!val && val !== 0) return '';
    return val.toString().trim().replace(/[^a-zA-Z0-9_\-\.\#]/g, '').slice(0, maxLen);
};

// In-Memory Sliding-Window Rate Limiter for validation and sensitive queries
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

const isRateLimited = (ip) => {
    const now = Date.now();
    const timestamps = rateLimitMap.get(ip) || [];
    const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);

    if (valid.length >= MAX_REQUESTS_PER_WINDOW) {
        return true;
    }

    valid.push(now);
    rateLimitMap.set(ip, valid);
    return false;
};

// Periodic garbage collection to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of rateLimitMap.entries()) {
        const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
        if (valid.length === 0) {
            rateLimitMap.delete(ip);
        } else {
            rateLimitMap.set(ip, valid);
        }
    }
}, 5 * 60 * 1000);

// Helper function to generate auth headers and execute MooGold API requests
const moogoldRequest = async (path, payloadData = {}, attempt = 0) => {
    const partnerId = (process.env.MOOGOLD_PARTNER_ID || '').trim();
    const secret = (process.env.MOOGOLD_SECRET || '').trim();

    if (!partnerId || !secret) {
        throw new Error('MooGold API credentials missing in server environment');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = { ...payloadData, path };
    const payloadStr = JSON.stringify(body);
    const stringToSign = payloadStr + timestamp + path;

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

    const currentProxy = STATIC_PROXIES.length > 0 ? STATIC_PROXIES[activeProxyIndex % STATIC_PROXIES.length] : null;
    const httpsAgent = currentProxy ? new HttpsProxyAgent(currentProxy) : undefined;

    const axiosConfig = {
        method: 'POST',
        url: `${BASE_URL}/${path}`,
        headers,
        data: body,
        httpsAgent,
        timeout: 25000
    };

    try {
        const response = await axios(axiosConfig);
        return response.data;
    } catch (error) {
        // If proxy failed (auth, timeout, connection reset), rotate and retry with next proxy
        const isProxyError = error.code === 'ECONNRESET' || error.message.includes('407') || error.message.includes('ECONNREFUSED');
        if (isProxyError && attempt < STATIC_PROXIES.length) {
            console.warn(`[MooGold Proxy] Proxy at index ${activeProxyIndex} encountered issue (${error.message}). Retrying next static proxy...`);
            activeProxyIndex = (activeProxyIndex + 1) % STATIC_PROXIES.length;
            return moogoldRequest(path, payloadData, attempt + 1);
        }

        // Redact any headers/secrets from error logs to prevent credential leakage
        const safeErr = error.response ? {
            status: error.response.status,
            data: error.response.data
        } : { message: error.message };
        console.error(`[MooGold API] Error on ${path}:`, safeErr);
        throw error;
    }
};

// Balance Cache
let balanceCache = { data: null, timestamp: 0 };
const BALANCE_CACHE_TTL = 30 * 1000; // 30 seconds

const clearBalanceCache = () => {
    balanceCache = { data: null, timestamp: 0 };
};

// GET /api/moogold/balance - Check wallet balance [ADMIN ONLY - PROTECTED]
router.get('/balance', requireAdmin, async (req, res) => {
    try {
        if (balanceCache.data && (Date.now() - balanceCache.timestamp < BALANCE_CACHE_TTL)) {
            return res.json(balanceCache.data);
        }

        const data = await moogoldRequest('user/balance');
        const rawBalance = parseFloat(data?.balance || 0);

        balanceCache = {
            data: {
                success: true,
                balance: rawBalance,
                balance_usd: rawBalance,
                currency: data?.currency || 'USD'
            },
            timestamp: Date.now()
        };

        res.json(balanceCache.data);
    } catch (error) {
        if (balanceCache.data) {
            return res.json(balanceCache.data);
        }
        res.status(500).json({
            success: false,
            balance: 0,
            balance_usd: 0,
            error: 'Failed to fetch MooGold balance'
        });
    }
});

// GET /api/moogold/test-proxy - Verify outgoing static IP [ADMIN ONLY]
router.get('/test-proxy', requireAdmin, async (req, res) => {
    try {
        const results = [];
        for (const proxy of STATIC_PROXIES) {
            try {
                const agent = new HttpsProxyAgent(proxy);
                const testRes = await axios.get('https://api.ipify.org?format=json', {
                    httpsAgent: agent,
                    timeout: 8000
                });
                results.push({ proxy: proxy.replace(/:[^:]*@/, ':***@'), ip: testRes.data.ip, status: 'ok' });
            } catch (err) {
                results.push({ proxy: proxy.replace(/:[^:]*@/, ':***@'), error: err.message, status: 'failed' });
            }
        }
        res.json({ success: true, proxies: results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/moogold/check-availability - Public stock check [SAFE - DOES NOT EXPOSE BALANCE]
router.get('/check-availability', async (req, res) => {
    try {
        const requiredPrice = parseFloat(req.query.price || 0);
        if (isNaN(requiredPrice) || requiredPrice < 0) {
            return res.status(400).json({ success: false, available: false });
        }

        if (!balanceCache.data || (Date.now() - balanceCache.timestamp > BALANCE_CACHE_TTL)) {
            const data = await moogoldRequest('user/balance');
            const rawBalance = parseFloat(data?.balance || 0);
            balanceCache = {
                data: {
                    success: true,
                    balance: rawBalance,
                    balance_usd: rawBalance,
                    currency: data?.currency || 'USD'
                },
                timestamp: Date.now()
            };
        }

        const currentBalance = parseFloat(balanceCache.data?.balance || 0);
        const available = currentBalance > 0 && (requiredPrice <= 0 || currentBalance >= requiredPrice);

        return res.json({
            success: true,
            available
        });
    } catch (err) {
        return res.status(500).json({ success: false, available: false });
    }
});

// Games List Cache
let gamesCache = { data: null, timestamp: 0 };
const GAMES_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Helper to determine rapidApiId and default image for known titles
const getGameMetadata = (title) => {
    const t = (title || '').toLowerCase();
    if (t.includes('mobile legend')) {
        return {
            rapidApiId: 'mobile-legends',
            sampleImage: 'https://res.cloudinary.com/cqiocigr/image/upload/v1791781946/gametopup/v2cjgkslrnvsrr08k5q3.jpg',
            needsZoneId: true,
            publisher: 'Moonton'
        };
    }
    if (t.includes('free fire')) {
        return {
            rapidApiId: 'freefire',
            sampleImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
            needsZoneId: false,
            publisher: 'Garena'
        };
    }
    if (t.includes('pubg')) {
        return {
            rapidApiId: 'pubg-mobile',
            sampleImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
            needsZoneId: false,
            publisher: 'Krafton'
        };
    }
    if (t.includes('genshin')) {
        return {
            rapidApiId: 'genshin-impact',
            sampleImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
            needsZoneId: true,
            publisher: 'HoYoverse'
        };
    }
    if (t.includes('valorant')) {
        return {
            rapidApiId: 'valorant',
            sampleImage: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=600&q=80',
            needsZoneId: false,
            publisher: 'Riot Games'
        };
    }
    if (t.includes('honor of kings')) {
        return {
            rapidApiId: 'honor-of-kings',
            sampleImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
            needsZoneId: false,
            publisher: 'Level Infinite'
        };
    }
    return {
        rapidApiId: 'mobile-legends',
        sampleImage: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=600&q=80',
        needsZoneId: false,
        publisher: 'Official'
    };
};

// GET /api/moogold/games - Import Catalog [ADMIN ONLY - PROTECTED]
router.get('/games', requireAdmin, async (req, res) => {
    try {
        if (gamesCache.data && (Date.now() - gamesCache.timestamp < GAMES_CACHE_TTL)) {
            return res.json({
                success: true,
                count: gamesCache.data.length,
                games: gamesCache.data
            });
        }

        const data = await moogoldRequest('product/list_product', {
            category_id: 50 // Direct top-up games
        });

        if (Array.isArray(data)) {
            const enriched = data.map(item => {
                const meta = getGameMetadata(item.post_title);
                return {
                    ID: item.ID,
                    moogoldId: item.ID,
                    post_title: item.post_title,
                    name: item.post_title,
                    publisher: getGameMetadata(item.post_title).publisher || 'Official',
                    provider: 'moogold',
                    sampleImage: meta.sampleImage,
                    rapidApiId: meta.rapidApiId,
                    needsZoneId: meta.needsZoneId
                };
            });

            gamesCache = {
                data: enriched,
                timestamp: Date.now()
            };

            return res.json({
                success: true,
                count: enriched.length,
                games: enriched
            });
        }

        res.json({ success: true, count: 0, games: [] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch catalog' });
    }
});

// Product variations cache
const productCache = {};
const PRODUCT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// GET /api/moogold/products/:game_id - Get packages/variations for a game [SANITIZED & CACHED]
router.get('/products/:game_id', authMiddleware, async (req, res) => {
    try {
        const gameIdParam = sanitizeInput(req.params.game_id, 32);
        if (!gameIdParam) {
            return res.status(400).json({ success: false, error: 'Valid MooGold Game ID required' });
        }

        let numericMoogoldId = null;
        let dbGame = null;

        // Check if gameIdParam is MongoDB ObjectId (24 hex characters)
        if (gameIdParam.length === 24 && /^[0-9a-fA-F]{24}$/.test(gameIdParam)) {
            dbGame = await Game.findById(gameIdParam);
            if (dbGame && dbGame.moogoldId) {
                numericMoogoldId = parseInt(dbGame.moogoldId);
            }
        } else {
            numericMoogoldId = parseInt(gameIdParam);
            dbGame = await Game.findOne({ moogoldId: gameIdParam });
        }

        if (!numericMoogoldId || isNaN(numericMoogoldId)) {
            return res.status(400).json({ success: false, error: 'Valid MooGold Game ID required' });
        }

        let data;
        const cacheKey = numericMoogoldId.toString();

        if (productCache[cacheKey] && productCache[cacheKey].timestamp > Date.now() - PRODUCT_CACHE_TTL) {
            data = productCache[cacheKey].data;
        } else {
            data = await moogoldRequest('product/product_detail', {
                product_id: numericMoogoldId
            });

            productCache[cacheKey] = {
                data,
                timestamp: Date.now()
            };
        }

        // Apply custom prices and strictly sanitize public response
        if (data && Array.isArray(data.Variation)) {
            const isAdmin = req.user && req.user.role === 'admin';
            const cleanVariations = data.Variation.map(variation => {
                const basePrice = parseFloat(variation.variation_price || 0);
                let sellPrice = basePrice;

                if (dbGame && dbGame.customPrices) {
                    const custom = dbGame.customPrices.get 
                        ? dbGame.customPrices.get(variation.variation_id.toString())
                        : dbGame.customPrices[variation.variation_id.toString()];

                    if (custom !== undefined && custom !== null && !isNaN(custom)) {
                        sellPrice = parseFloat(custom);
                    }
                }

                const isFeatured = (dbGame && Array.isArray(dbGame.featuredPackages))
                    ? dbGame.featuredPackages.includes(variation.variation_id.toString())
                    : false;

                // Strip supplier SKU (#...) from variation name for clean public presentation
                const cleanName = (variation.variation_name || '').replace(/\s*\(#\d+\)\s*$/, '').trim();

                const item = {
                    variation_id: variation.variation_id,
                    variation_name: cleanName,
                    variation_price: sellPrice,
                    stock_status: variation.stock_status || 'instock',
                    is_featured: isFeatured
                };

                // Wholesale cost and supplier fields are strictly hidden from public visitors
                // and only visible to authorized Admins (e.g. inside Admin Price Manager)
                if (isAdmin) {
                    item.original_price = basePrice;
                    item.price_usd = basePrice;
                }

                return item;
            });

            return res.json({
                success: true,
                Variation: cleanVariations
            });
        }

        res.json({ success: true, ...data });
    } catch (error) {
        console.error('[MooGold] Product detail error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch product details' });
    }
});

// POST /api/moogold/validate - Validate player ID and get In-Game Name [RATE LIMITED & SANITIZED]
router.post('/validate', async (req, res) => {
    try {
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
        if (isRateLimited(clientIp)) {
            return res.status(429).json({ error: 'Too many validation requests. Please wait a moment.' });
        }

        const { gameId, dbGameId, playerId, zoneId } = req.body;
        const targetId = sanitizeInput(dbGameId || gameId, 32);
        const cleanPlayerId = sanitizeInput(playerId, 25);
        const cleanZoneId = sanitizeInput(zoneId, 15);

        if (!cleanPlayerId) {
            return res.status(400).json({ error: 'Player ID is required' });
        }

        let game = null;
        if (targetId && targetId.length === 24 && /^[0-9a-fA-F]{24}$/.test(targetId)) {
            game = await Game.findById(targetId);
        } else if (targetId) {
            game = await Game.findOne({ moogoldId: targetId });
        }

        const gameSlug = game?.rapidApiId || 'mobile-legends';

        let rapidApiUrl = '';
        if (cleanZoneId && cleanZoneId.trim() !== '') {
            rapidApiUrl = `https://id-game-checker.p.rapidapi.com/${encodeURIComponent(gameSlug)}/${encodeURIComponent(cleanPlayerId)}/${encodeURIComponent(cleanZoneId)}`;
        } else {
            rapidApiUrl = `https://id-game-checker.p.rapidapi.com/${encodeURIComponent(gameSlug)}/${encodeURIComponent(cleanPlayerId)}`;
        }

        try {
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
        } catch (rapidErr) {
            return res.status(400).json({ error: 'Invalid Player ID or Server ID.' });
        }
    } catch (error) {
        console.error('[MooGold Validate] Server Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Helper for Order creation
const createMoogoldTransaction = async ({ productId, playerId, serverId, refId }) => {
    const cleanProductId = parseInt(productId) || productId;
    const cleanPlayerId = sanitizeInput(playerId, 25);
    const cleanServerId = sanitizeInput(serverId, 15);
    const cleanRefId = sanitizeInput(refId, 32);

    const dataObj = {
        category: 50,
        'product-id': cleanProductId,
        quantity: 1,
        'User ID': cleanPlayerId,
        partnerOrderId: cleanRefId
    };

    if (cleanServerId && cleanServerId.trim() !== '') {
        dataObj['Server ID'] = cleanServerId.trim();
        dataObj['Zone ID'] = cleanServerId.trim();
        dataObj['Server'] = cleanServerId.trim();
    }

    const payload = {
        path: 'order/create_order',
        data: dataObj,
        partnerOrderId: cleanRefId
    };

    const result = await moogoldRequest('order/create_order', payload);
    clearBalanceCache();

    const isSuccess = result && (
        result.status === true ||
        result.status === 'true' ||
        result.status === 'processing' ||
        result.status === 'success' ||
        result.order_id ||
        result.transaction_id ||
        (result.message && result.message.toLowerCase().includes('success'))
    );

    if (isSuccess) {
        const rawStatus = (result.order_status || result.status || 'sending').toString().toLowerCase();
        const isCompleted = rawStatus === 'completed';
        return {
            status: isCompleted ? 'completed' : 'processing',
            order_status: rawStatus,
            ref_id: (result.order_id || result.transaction_id || cleanRefId).toString(),
            message: result.message || (isCompleted ? 'Order completed successfully' : 'Order placed, sending diamonds to player account'),
            data: result
        };
    } else {
        const errMsg = result?.err_message || result?.message || 'Unable to place order';
        const err = new Error(errMsg);
        err.response = { data: result };
        throw err;
    }
};

// Check live order status helper
const checkMoogoldOrderStatus = async (orderId) => {
    try {
        const cleanOrderId = sanitizeInput(orderId, 25);
        const data = await moogoldRequest('order/order_detail', { order_id: parseInt(cleanOrderId) || cleanOrderId });
        const rawStatus = (data?.order_status || '').toLowerCase();
        
        let normalizedStatus = 'processing';
        if (rawStatus === 'completed') {
            normalizedStatus = 'completed';
        } else if (rawStatus === 'refunded' || rawStatus === 'failed' || rawStatus === 'cancelled' || rawStatus === 'incorrect-details') {
            normalizedStatus = 'failed';
        } else if (rawStatus === 'sending' || rawStatus === 'processing' || rawStatus === 'pending') {
            normalizedStatus = 'processing';
        }

        return {
            status: normalizedStatus,
            order_status: rawStatus,
            raw: data
        };
    } catch (err) {
        console.error(`[MooGold] checkMoogoldOrderStatus error for #${orderId}:`, err.message);
        throw err;
    }
};

// POST /api/moogold/callback - Webhook for MooGold automated order callbacks [SANITIZED]
router.post('/callback', async (req, res) => {
    try {
        const partnerOrderId = sanitizeInput(req.body?.partnerOrderId, 32);
        const order_id = sanitizeInput(req.body?.order_id, 32);
        const order_status = (req.body?.order_status || '').toString().toLowerCase().slice(0, 25);
        const Transaction = require('../models/Transaction');

        const query = [];
        if (partnerOrderId && /^[0-9a-fA-F]{24}$/.test(partnerOrderId)) {
            query.push({ _id: partnerOrderId });
        }
        if (order_id) {
            query.push({ providerReference: order_id });
        }

        if (query.length > 0) {
            const tx = await Transaction.findOne({ $or: query });
            if (tx) {
                if (order_status === 'completed') {
                    tx.status = 'completed';
                    tx.deliveryStatus = 'delivered';
                } else if (order_status === 'refunded' || order_status === 'failed' || order_status === 'cancelled' || order_status === 'incorrect-details') {
                    tx.status = 'failed';
                    tx.deliveryStatus = 'failed';
                    tx.errorDetails = order_status === 'refunded' ? 'Delivery refunded' : `Delivery ${order_status}`;
                } else if (order_status === 'sending' || order_status === 'processing') {
                    tx.status = 'processing';
                    tx.deliveryStatus = 'sending';
                }
                await tx.save();
                console.log(`[MooGold Webhook] Order #${order_id || tx._id} updated: status=${tx.status}, delivery=${tx.deliveryStatus}`);
            }
        }

        // MooGold requires strict HTTP 200 {"status": "success"} response
        return res.status(200).json({ status: 'success' });
    } catch (err) {
        console.error('[MooGold Webhook] Handler error:', err.message);
        return res.status(200).json({ status: 'success' });
    }
});

// GET /api/moogold/order/:order_id - Get order details [ADMIN ONLY - PROTECTED]
router.get('/order/:order_id', requireAdmin, async (req, res) => {
    try {
        const cleanOrderId = sanitizeInput(req.params.order_id, 25);
        const payload = {
            order_id: cleanOrderId
        };
        const data = await moogoldRequest('order/order_detail', payload);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
});

module.exports = {
    router,
    moogoldRequest,
    createMoogoldTransaction,
    checkMoogoldOrderStatus,
    clearBalanceCache
};
