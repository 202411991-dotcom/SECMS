import { verifyAuthToken } from '../utils/authTokens.js';

function authenticate(req, res, next, requiredRole) {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const payload = match ? verifyAuthToken(match[1]) : null;

    if (!payload || (requiredRole && payload.role !== requiredRole)) {
        return res.status(401).json({ error: 'Authentication is required.' });
    }

    req.auth = payload;
    next();
}

export function requireUser(req, res, next) {
    return authenticate(req, res, next, 'user');
}

export function requireAdmin(req, res, next) {
    return authenticate(req, res, next, 'admin');
}
