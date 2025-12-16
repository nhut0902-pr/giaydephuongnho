const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * JWT secret MUST come from environment variables
 * Do NOT hardcode secrets in source code
 */
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('❌ JWT_SECRET is not defined in environment variables');
}

/**
 * Middleware: Require authentication
 */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findByPk(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Middleware: Optional authentication
 * (token có thì nhận user, không có thì bỏ qua)
 */
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.userId);
        if (user) {
            req.user = user;
        }
    } catch (err) {
        // Token lỗi → bỏ qua, không chặn request
    }

    next();
};

/**
 * Middleware: Require admin role
 */
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Admin access required' });
};

module.exports = {
    authenticateToken,
    optionalAuth,
    isAdmin,
};
