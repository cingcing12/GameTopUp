const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'gtu_sec_9f7a83d1c4e2056b82419ef012ab684c90e72bf851a';

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    
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

const requireAdmin = (req, res, next) => {
    requireAuth(req, res, () => {
        if (req.user && req.user.role === 'admin') {
            return next();
        }
        return res.status(403).json({ message: 'Access denied. Admins only.' });
    });
};

module.exports = { authMiddleware, requireAuth, requireAdmin, JWT_SECRET };
