import { Router } from 'express';
import User from '../models/User.js';
import { requireUser } from '../middleware/auth.js';
import { ELECTRICITY_PROVIDERS } from '../constants/providers.js';
import Notification from '../models/Notification.js';
import { createReadingNotification } from '../utils/energyNotifications.js';
import { toPublicUser } from '../utils/publicUser.js';

const router = Router();
router.use(requireUser);

router.put('/', async (req, res, next) => {
    try {
        const previousReading = Number(req.body?.previousReading);
        const presentReading = Number(req.body?.presentReading);
        const ratePerKwh = Number(req.body?.ratePerKwh);
        const completeAddress = typeof req.body?.completeAddress === 'string' ? req.body.completeAddress.trim() : '';
        const phoneNumber = typeof req.body?.phoneNumber === 'string' ? req.body.phoneNumber.trim() : '';
        const selectedProvider = typeof req.body?.electricityProvider === 'string'
            ? req.body.electricityProvider.trim()
            : '';
        const otherProvider = typeof req.body?.otherProvider === 'string' ? req.body.otherProvider.trim() : '';
        const electricityProvider = selectedProvider === 'Other' ? otherProvider : selectedProvider;
        const digitCount = phoneNumber.replace(/\D/g, '').length;

        if (!Number.isFinite(previousReading) || previousReading < 0 ||
            !Number.isFinite(presentReading) || presentReading < previousReading ||
            !Number.isFinite(ratePerKwh) || ratePerKwh < 0) {
            return res.status(400).json({ error: 'Enter valid meter readings and a non-negative rate. Present reading must be at least the previous reading.' });
        }
        if (completeAddress.length < 8 || completeAddress.length > 500) {
            return res.status(400).json({ error: 'Enter a complete address between 8 and 500 characters.' });
        }
        if (!/^\+?[0-9][0-9\s().-]{6,24}$/.test(phoneNumber) || digitCount < 7 || digitCount > 15) {
            return res.status(400).json({ error: 'Enter a valid phone number with 7 to 15 digits.' });
        }
        if ((!ELECTRICITY_PROVIDERS.includes(selectedProvider) && selectedProvider !== 'Other') ||
            (selectedProvider === 'Other' && (otherProvider.length < 2 || otherProvider.length > 120))) {
            return res.status(400).json({ error: 'Select an electricity provider or enter the provider name.' });
        }

        const user = await User.findById(req.auth.sub);
        if (!user) return res.status(401).json({ error: 'User account was not found.' });

        const wasProfileComplete = user.isProfileComplete;
        const previousConsumption = user.initialConsumptionKwh;
        const oldPreviousReading = user.previousReading;
        const oldPresentReading = user.presentReading;
        const initialConsumptionKwh = Number((presentReading - previousReading).toFixed(4));
        const estimatedInitialBill = Number((initialConsumptionKwh * ratePerKwh).toFixed(2));
        user.previousReading = previousReading;
        user.presentReading = presentReading;
        user.ratePerKwh = ratePerKwh;
        user.completeAddress = completeAddress;
        user.phoneNumber = phoneNumber;
        user.electricityProvider = electricityProvider;
        user.initialConsumptionKwh = initialConsumptionKwh;
        if (!wasProfileComplete || user.consumptionBaselineKwh === null || user.consumptionBaselineKwh === undefined) {
            user.consumptionBaselineKwh = initialConsumptionKwh;
        }
        user.estimatedInitialBill = estimatedInitialBill;
        user.isProfileComplete = true;
        await user.save();

        if (!wasProfileComplete) {
            await Notification.create({
                userId: user._id,
                title: 'Energy profile setup complete',
                message: `Your initial consumption baseline is ${initialConsumptionKwh.toFixed(2)} kWh.`,
                type: 'success'
            });
        } else if (previousConsumption !== initialConsumptionKwh ||
            oldPreviousReading !== previousReading || oldPresentReading !== presentReading) {
            await createReadingNotification({
                userId: user._id,
                currentKwh: initialConsumptionKwh,
                baselineKwh: user.consumptionBaselineKwh ?? previousConsumption
            });
        }

        res.json({ user: toPublicUser(user) });
    } catch (error) {
        next(error);
    }
});

export default router;
