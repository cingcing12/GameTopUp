const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

const authMiddleware = (req, res, next) => {
    // Optional check: if route wants to allow guest, use a different middleware or pass a flag
    // but here we just require it. Or we can just try to extract it and attach to req.user.
    const token = req.header('Authorization')?.split(' ')[1];
    
    // For optional auth (where guests are allowed but we want to identify logged in users)
    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        req.user = null;
        next();
    }
};

const requireAuth = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

module.exports = { authMiddleware, requireAuth };
