const jwt = require('jsonwebtoken');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            companyId: decoded.companyId
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        console.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
}

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - Array of roles that can access the route
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
}

/**
 * Optional auth middleware
 * Attaches user if token is valid, but doesn't block if no token
 */
function optionalAuth(req, res, next) {
    console.log('[OptionalAuth] Processing request to:', req.path);
    try {
        const authHeader = req.headers.authorization;
        console.log('[OptionalAuth] Auth header present:', !!authHeader);

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

            req.user = {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role,
                companyId: decoded.companyId
            };
            console.log('[OptionalAuth] User authenticated:', req.user.email);
        } else {
            console.log('[OptionalAuth] No valid token, continuing without user');
        }
    } catch (error) {
        // Token invalid or expired, continue without user
        console.log('[OptionalAuth] Token error, continuing without user:', error.message);
        req.user = null;
    }

    console.log('[OptionalAuth] Calling next()');
    next();
}

module.exports = {
    authMiddleware,
    requireRole,
    optionalAuth
};
