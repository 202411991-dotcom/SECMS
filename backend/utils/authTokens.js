import { createHmac, timingSafeEqual } from 'node:crypto';

function getSecret() {
    const secret = process.env.AUTH_TOKEN_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('AUTH_TOKEN_SECRET must contain at least 32 characters.');
    }
    return secret;
}

export function createAuthToken({ sub, role }, lifetimeSeconds = 60 * 60 * 24 * 7) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        sub: String(sub),
        role,
        iat: issuedAt,
        exp: issuedAt + lifetimeSeconds
    })).toString('base64url');
    const unsignedToken = `${header}.${payload}`;
    const signature = createHmac('sha256', getSecret()).update(unsignedToken).digest('base64url');
    return `${unsignedToken}.${signature}`;
}

export function verifyAuthToken(token) {
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 3) return null;

    const unsignedToken = `${parts[0]}.${parts[1]}`;
    const expected = createHmac('sha256', getSecret()).update(unsignedToken).digest();
    let actual;
    try {
        actual = Buffer.from(parts[2], 'base64url');
    } catch {
        return null;
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    try {
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (header.alg !== 'HS256' || !payload.sub || !payload.role || payload.exp <= Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}
