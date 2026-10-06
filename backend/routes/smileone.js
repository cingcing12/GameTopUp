const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Utility function to generate Smile.One signature
function makeSign(params, secretKey) {
    // 1. Sort by key name in ascending order
    const sortedKeys = Object.keys(params).sort();
    
    // 2. Construct the query string (e.g., uid=xxx&sid=xxx)
    const queryParams = new URLSearchParams();
    sortedKeys.forEach(key => {
        queryParams.append(key, params[key]);
    });
    
    // The query string is something like: game_id=123&role_id=456&server_id=789
    // NOTE: URLSearchParams replaces spaces with '+' which might differ from http_build_query in PHP. 
    // Usually, simple strings without spaces are used for role checks.
    let str = queryParams.toString();
    
    // 3. Splicing Key (appended directly)
    str += secretKey;
    
    // 4. Double md5
    const firstMd5 = crypto.createHash('md5').update(str).digest('hex');
    const secondMd5 = crypto.createHash('md5').update(firstMd5).digest('hex');
    
    return secondMd5;
}

// Route to check Role ID (Player ID) via Smile.One API
router.post('/role-check', async (req, res) => {
    try {
        const { game_id, role_id, server_id } = req.body;
        
        // --- IMPORTANT ---
        // Put your Smile.One Merchant ID (uid), Email, and Secret Key in your .env file
        const mch_uid = process.env.SMILE_ONE_UID || 'YOUR_MERCHANT_UID';
        const mch_email = process.env.SMILE_ONE_EMAIL || 'YOUR_MERCHANT_EMAIL';
        const secret_key = process.env.SMILE_ONE_SECRET_KEY || 'YOUR_SECRET_KEY';
        const timestamp = Math.floor(Date.now() / 1000);

        // Parameters required by Smile.One for role check
        // NOTE: Please check your API doc to confirm the exact parameter names
        // Sometimes they use 'uid' for merchant ID, sometimes 'mch_id', etc.
        const sign_arr = {
            uid: mch_uid,
            email: mch_email,
            productid: game_id, // Usually the internal game ID on Smile.one
            roleid: role_id,
            zoneid: server_id,
            time: timestamp
        };

        // Generate the signature
        const sign = makeSign(sign_arr, secret_key);

        // Add the signature to our payload
        const payload = {
            ...sign_arr,
            sign: sign
        };

        // Send POST request to Smile.One API (replace with actual endpoint URL from your docs)
        const SMILE_ONE_API_URL = 'https://smile.one/api/rolecheck'; // Example URL, check docs!
        
        const response = await fetch(SMILE_ONE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // Send back the response from Smile.One to your Vue frontend
        res.status(200).json(data);
    } catch (error) {
        console.error('Smile.One Role Check Error:', error);
        res.status(500).json({ message: 'Error connecting to API gateway' });
    }
});

module.exports = router;
