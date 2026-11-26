import Notification from '../models/Notification.js';

export const HIGH_CONSUMPTION_MULTIPLIER = 1.5;
export const CRITICAL_CONSUMPTION_MULTIPLIER = 2;

export function getConsumptionAlertType(currentKwh, baselineKwh) {
    const current = Number(currentKwh);
    const baseline = Number(baselineKwh);
    if (!Number.isFinite(current) || current < 0 || !Number.isFinite(baseline) || baseline <= 0) {
        return null;
    }
    if (current >= baseline * CRITICAL_CONSUMPTION_MULTIPLIER) return 'critical';
    if (current >= baseline * HIGH_CONSUMPTION_MULTIPLIER) return 'warning';
    return null;
}

export async function createReadingNotification({ userId, currentKwh, baselineKwh }) {
    const alertType = getConsumptionAlertType(currentKwh, baselineKwh);
    const formattedKwh = Number.isFinite(Number(currentKwh)) ? Number(currentKwh).toFixed(2) : '0.00';
    const formattedBaseline = Number.isFinite(Number(baselineKwh)) ? Number(baselineKwh).toFixed(2) : '0.00';

    if (alertType === 'critical') {
        return Notification.create({
            userId,
            title: 'Critical energy use detected',
            message: `Your latest consumption is ${formattedKwh} kWh, at least twice your setup baseline of ${formattedBaseline} kWh.`,
            type: 'critical'
        });
    }
    if (alertType === 'warning') {
        return Notification.create({
            userId,
            title: 'High energy use detected',
            message: `Your latest consumption is ${formattedKwh} kWh, at least 50% above your setup baseline of ${formattedBaseline} kWh.`,
            type: 'warning'
        });
    }

    return Notification.create({
        userId,
        title: 'Energy reading updated',
        message: `Your latest consumption reading is ${formattedKwh} kWh.`,
        type: 'info'
    });
}
