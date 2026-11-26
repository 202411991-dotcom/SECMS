import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    type: { type: String, enum: ['info', 'success', 'warning', 'critical'], default: 'info', index: true },
    isRead: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1, type: 1 });

export default mongoose.model('Notification', notificationSchema);
