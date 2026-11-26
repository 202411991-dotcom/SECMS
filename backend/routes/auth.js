import { Router } from 'express';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import User from '../models/User.js';
import { createAuthToken } from '../utils/authTokens.js';
import { toPublicUser } from '../utils/publicUser.js';

const router = Router();
const scrypt = promisify(scryptCallback);
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function normalizeCredentials(body = {}) {
    return {
        fullName: typeof body.fullName === 'string' ? body.fullName.trim() : '',
        accountNumber: typeof body.accountNumber === 'string' ? body.accountNumber.trim() : '',
        email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : '',
        password: typeof body.password === 'string' ? body.password : ''
    };
}

async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}

async function passwordMatches(password, storedHash) {
    if (/^\$2[aby]\$/.test(storedHash || '')) {
        return bcrypt.compare(password, storedHash);
    }

    const [saltText, keyText] = (storedHash || '').split('.');
    if (!saltText || !keyText) return false;
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(keyText, 'base64url');
    const actual = await scrypt(password, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createResetTransport() {
    const host = process.env.SMTP_HOST?.trim();
    if (!host) return null;

    const port = Number.parseInt(process.env.SMTP_PORT, 10) || 587;
    const username = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASS;
    const auth = username && password ? { user: username, pass: password } : undefined;

    return {
        transport: nodemailer.createTransport({ host, port, secure: port === 465, ...(auth ? { auth } : {}) }),
        from: process.env.SMTP_FROM?.trim() || username
    };
}

function makeResetUrl(token) {
    const configuredBase = process.env.APP_BASE_URL?.trim();
    const base = configuredBase || (process.env.NODE_ENV === 'production'
        ? ''
        : `http://localhost:${Number.parseInt(process.env.PORT, 10) || 3000}`);
    if (!base) return null;

    const resetUrl = new URL('/reset-password.html', base);
    resetUrl.searchParams.set('token', token);
    return resetUrl.toString();
}

router.post('/register', async (req, res, next) => {
    try {
        const { fullName, accountNumber, email, password } = normalizeCredentials(req.body);
        if (fullName.length < 2 || fullName.length > 100 ||
            !/^[A-Za-z0-9_-]{4,32}$/.test(accountNumber) ||
            !isValidEmail(email) || password.length < 8 || password.length > 128) {
            return res.status(400).json({ error: 'Enter a valid name, account number, email, and password (at least 8 characters).' });
        }

        const passwordHash = await hashPassword(password);
        const user = await User.create({ fullName, accountNumber, email, passwordHash });
        const token = createAuthToken({ sub: user._id, role: 'user' });
        res.status(201).json({ token, user: toPublicUser(user) });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'That account number or email is already registered.' });
        }
        next(error);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const { accountNumber, password } = normalizeCredentials(req.body);
        if (!accountNumber || !password) {
            return res.status(400).json({ error: 'Enter your account number and password.' });
        }

        const user = await User.findOne({ accountNumber }).select('+passwordHash');
        if (!user || !(await passwordMatches(password, user.passwordHash))) {
            return res.status(401).json({ error: 'Account number or password is incorrect.' });
        }
        if (user.accountStatus !== 'active') {
            return res.status(403).json({ error: 'This account is inactive. Contact your administrator.' });
        }

        const token = createAuthToken({ sub: user._id, role: 'user' });
        res.json({ token, user: toPublicUser(user) });
    } catch (error) {
        next(error);
    }
});

router.post('/forgot-password', async (req, res, next) => {
    try {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Enter a valid email address.' });
        }

        const genericMessage = 'If an account exists for that email, password reset instructions are ready.';
        const mail = createResetTransport();
        const resetUrlConfigured = Boolean(makeResetUrl('configuration-check'));
        if ((process.env.NODE_ENV === 'production' && !mail) ||
            (mail && (!mail.from || !resetUrlConfigured))) {
            return res.status(503).json({ error: 'Password reset email is not fully configured.' });
        }

        const user = await User.findOne({ email });
        if (!user) return res.json({ message: genericMessage });

        const token = randomBytes(32).toString('hex');
        user.resetPasswordToken = createHash('sha256').update(token).digest('hex');
        user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

        const resetUrl = makeResetUrl(token);
        if (mail) {
            await user.save();
            try {
                await mail.transport.sendMail({
                    from: mail.from,
                    to: user.email,
                    subject: 'Reset your SECMS password',
                    text: `Use this link within 30 minutes to reset your password: ${resetUrl}`
                });
            } catch (error) {
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;
                await user.save();
                console.error(`[auth] Password reset email delivery failed: ${error.code || error.name || 'UnknownError'}`);
                return res.status(503).json({ error: 'Password reset email could not be sent. Please try again later.' });
            }
            return res.json({ message: genericMessage });
        }

        if (process.env.NODE_ENV === 'production' || !resetUrl) {
            return res.status(503).json({ error: 'Password reset email is not configured.' });
        }

        await user.save();
        return res.json({
            message: 'Local testing mode: use this password reset link. It expires in 30 minutes.',
            resetUrl
        });
    } catch (error) {
        next(error);
    }
});

router.post('/reset-password', async (req, res, next) => {
    try {
        const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        if (!/^[a-f0-9]{64}$/i.test(token) || password.length < 8 || password.length > 128) {
            return res.status(400).json({ error: 'Use a valid reset link and a password between 8 and 128 characters.' });
        }

        const resetPasswordToken = createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpires: { $gt: new Date() }
        }).select('+resetPasswordToken +resetPasswordExpires');
        if (!user) return res.status(400).json({ error: 'This password reset link is invalid or has expired.' });

        user.passwordHash = await hashPassword(password);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Your password has been reset. You can now sign in.' });
    } catch (error) {
        next(error);
    }
});

router.post('/admin-login', (req, res) => {
    const configuredUsername = process.env.ADMIN_USERNAME;
    const configuredPassword = process.env.ADMIN_PASSWORD;
    if (!configuredUsername || !configuredPassword) {
        return res.status(503).json({ error: 'Administrator login has not been configured.' });
    }

    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const safeCompare = (actual, expected) => {
        const actualBuffer = Buffer.from(actual);
        const expectedBuffer = Buffer.from(expected);
        return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
    };

    if (!safeCompare(username, configuredUsername) || !safeCompare(password, configuredPassword)) {
        return res.status(401).json({ error: 'Administrator username or password is incorrect.' });
    }

    const token = createAuthToken({ sub: 'secms-admin', role: 'admin' }, 60 * 60 * 8);
    res.json({ token, admin: { username: configuredUsername, role: 'admin' } });
});

export default router;
