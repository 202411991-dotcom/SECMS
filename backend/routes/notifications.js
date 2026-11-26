import { Router } from 'express';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();
router.use(requireUser);

router.get('/', async (req, res, next) => {
    try {
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 50)
            : 20;
        const userId = req.auth.sub;
        const [notifications, unreadCount] = await Promise.all([
            Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean(),
            Notification.countDocuments({ userId, isRead: false })
        ]);
        res.json({ notifications, unreadCount });
    } catch (error) {
        next(error);
    }
});

router.patch('/read-all', async (req, res, next) => {
    try {
        const result = await Notification.updateMany(
            { userId: req.auth.sub, isRead: false },
            { $set: { isRead: true } }
        );
        res.json({ updatedCount: result.modifiedCount });
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/read', async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).json({ error: 'Notification was not found.' });
        }
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.auth.sub },
            { $set: { isRead: true } },
            { new: true }
        ).lean();
        if (!notification) return res.status(404).json({ error: 'Notification was not found.' });
        res.json({ notification });
    } catch (error) {
        next(error);
    }
});

export default router;
