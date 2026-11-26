import { Router } from 'express';
import User from '../models/User.js';
import { requireUser } from '../middleware/auth.js';
import { toPublicUser } from '../utils/publicUser.js';

const router = Router();
router.use(requireUser);

router.get('/me', async (req, res, next) => {
    try {
        const user = await User.findById(req.auth.sub);
        if (!user) return res.status(401).json({ error: 'User account was not found.' });
        res.json({ user: toPublicUser(user) });
    } catch (error) {
        next(error);
    }
});

router.patch('/me', async (req, res, next) => {
    try {
        const user = await User.findById(req.auth.sub);
        if (!user) return res.status(401).json({ error: 'User account was not found.' });

        const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : user.fullName;
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : user.email;
        const phoneNumber = typeof req.body?.phoneNumber === 'string' ? req.body.phoneNumber.trim() : user.phoneNumber;
        const completeAddress = typeof req.body?.completeAddress === 'string' ? req.body.completeAddress.trim() : user.completeAddress;

        if (fullName.length < 2 || fullName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Enter a valid name and email address.' });
        }
        if (phoneNumber && !/^\+?[0-9][0-9\s().-]{6,24}$/.test(phoneNumber)) {
            return res.status(400).json({ error: 'Enter a valid phone number.' });
        }
        if (completeAddress.length > 500) {
            return res.status(400).json({ error: 'Address must be 500 characters or fewer.' });
        }

        user.fullName = fullName;
        user.email = email;
        user.phoneNumber = phoneNumber;
        user.completeAddress = completeAddress;
        await user.save();
        res.json({ user: toPublicUser(user) });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'That email address is already in use.' });
        }
        next(error);
    }
});

export default router;
