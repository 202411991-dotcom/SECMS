import { Router } from 'express';
import EnergyReading from '../models/EnergyReading.js';
import User from '../models/User.js';
import { requireUser } from '../middleware/auth.js';
import { createReadingNotification } from '../utils/energyNotifications.js';

const router = Router();
router.use(requireUser);

router.get('/', async (req, res, next) => {
    try {
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 50;
        const readings = await EnergyReading.find({ userId: req.auth.sub })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        res.json({ count: readings.length, data: readings });
    } catch (error) {
        next(error);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const input = req.body?.reading ?? req.body;
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            return res.status(400).json({ error: 'A valid energy reading is required.' });
        }

        const user = await User.findById(req.auth.sub);
        if (!user) return res.status(401).json({ error: 'User account was not found.' });

        const reading = await EnergyReading.create({ ...input, userId: user._id });
        user.initialConsumptionKwh = reading.kwh;
        user.estimatedInitialBill = reading.estimatedCost;
        if (Number.isFinite(Number(input.previousReading)) && Number.isFinite(Number(input.presentReading))) {
            user.previousReading = Number(input.previousReading);
            user.presentReading = Number(input.presentReading);
        }
        if (Number.isFinite(Number(input.ratePerKwh)) && Number(input.ratePerKwh) >= 0) {
            user.ratePerKwh = Number(input.ratePerKwh);
        }
        await user.save();
        await createReadingNotification({
            userId: user._id,
            currentKwh: reading.kwh,
            baselineKwh: user.consumptionBaselineKwh ?? user.initialConsumptionKwh
        });
        res.status(201).json({ data: reading });
    } catch (error) {
        next(error);
    }
});

export default router;
