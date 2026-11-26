import { Router } from 'express';
import User from '../models/User.js';
import { requireAdmin } from '../middleware/auth.js';
import { toPublicUser } from '../utils/publicUser.js';
import EnergyReading from '../models/EnergyReading.js';
import Notification from '../models/Notification.js';
import { getAlertStatus } from '../utils/alertStatus.js';

const router = Router();
router.use(requireAdmin);

router.get('/users', async (req, res, next) => {
    try {
        const users = await User.find().sort({ createdAt: -1 }).lean();
        const userIds = users.map((user) => user._id);
        const [readings, activeAlerts] = userIds.length > 0
            ? await Promise.all([
                EnergyReading.find({ userId: { $in: userIds } })
                    .select('userId kwh timestamp')
                    .sort({ timestamp: -1 })
                    .lean(),
                Notification.find({
                    userId: { $in: userIds },
                    isRead: false,
                    type: { $in: ['warning', 'critical'] }
                }).select('userId type createdAt').sort({ createdAt: -1 }).lean()
            ])
            : [[], []];

        const latestReadingByUser = new Map();
        for (const reading of readings) {
            const key = String(reading.userId);
            if (!latestReadingByUser.has(key)) latestReadingByUser.set(key, reading);
        }
        const activeAlertByUser = new Map();
        for (const alert of activeAlerts) {
            const key = String(alert.userId);
            const current = activeAlertByUser.get(key);
            if (!current || alert.type === 'critical') activeAlertByUser.set(key, alert);
        }

        const result = users.map((user) => {
            const latestReading = latestReadingByUser.get(String(user._id)) || null;
            return {
                ...toPublicUser(user),
                alertStatus: getAlertStatus({
                    user,
                    latestReading,
                    activeAlert: activeAlertByUser.get(String(user._id))
                }),
                currentConsumptionKwh: latestReading?.kwh ?? user.initialConsumptionKwh ?? null
            };
        });
        res.json({ count: result.length, users: result });
    } catch (error) {
        next(error);
    }
});

router.get('/notifications', async (req, res, next) => {
    try {
        const notifications = await Notification.find()
            .sort({ createdAt: -1 })
            .limit(200)
            .populate('userId', 'fullName accountNumber')
            .lean();
        res.json({
            notifications: notifications.map((notification) => ({
                ...notification,
                targetName: notification.userId?.fullName || 'Deleted user',
                targetAccount: notification.userId?.accountNumber || ''
            }))
        });
    } catch (error) {
        next(error);
    }
});

router.post('/notifications', async (req, res, next) => {
    try {
        const targetAccount = typeof req.body?.targetAccount === 'string' ? req.body.targetAccount.trim() : '';
        const type = req.body?.type;
        const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
        const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
        if (!targetAccount || !['info', 'success', 'warning', 'critical'].includes(type) ||
            title.length < 2 || title.length > 120 || message.length < 2 || message.length > 2000) {
            return res.status(400).json({ error: 'Enter a valid recipient, alert type, title, and message.' });
        }

        const recipients = targetAccount === 'all'
            ? await User.find({ accountStatus: 'active' }).select('_id').lean()
            : await User.find({ accountNumber: targetAccount, accountStatus: 'active' }).select('_id').lean();
        if (recipients.length === 0) return res.status(404).json({ error: 'No active recipient account was found.' });

        await Notification.insertMany(recipients.map(({ _id: userId }) => ({ userId, title, message, type })));
        res.status(201).json({ createdCount: recipients.length });
    } catch (error) {
        next(error);
    }
});

router.patch('/users/:accountNumber/status', async (req, res, next) => {
    try {
        const updates = {};
        if (req.body?.billStatus !== undefined) {
            if (!['pending', 'paid', 'not-paid'].includes(req.body.billStatus)) {
                return res.status(400).json({ error: 'Choose a valid bill status.' });
            }
            updates.billStatus = req.body.billStatus;
        }
        if (req.body?.accountStatus !== undefined) {
            if (!['active', 'inactive'].includes(req.body.accountStatus)) {
                return res.status(400).json({ error: 'Choose a valid account status.' });
            }
            updates.accountStatus = req.body.accountStatus;
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Provide an account or bill status to update.' });
        }

        const user = await User.findOneAndUpdate(
            { accountNumber: req.params.accountNumber },
            { $set: updates },
            { new: true, runValidators: true }
        );
        if (!user) return res.status(404).json({ error: 'User account was not found.' });
        res.json({ user: toPublicUser(user) });
    } catch (error) {
        next(error);
    }
});

export default router;
