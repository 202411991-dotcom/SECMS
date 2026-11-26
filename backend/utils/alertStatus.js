import { CRITICAL_CONSUMPTION_MULTIPLIER, HIGH_CONSUMPTION_MULTIPLIER } from './energyNotifications.js';

export function getAlertStatus({ user, latestReading, activeAlert }) {
    const baseline = Number(user.consumptionBaselineKwh ?? user.initialConsumptionKwh);
    const current = Number(latestReading?.kwh ?? user.initialConsumptionKwh);
    const consumptionStatus = !Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(current)
        ? 'Normal'
        : current >= baseline * CRITICAL_CONSUMPTION_MULTIPLIER
            ? 'Critical'
            : current >= baseline * HIGH_CONSUMPTION_MULTIPLIER ? 'High' : 'Normal';

    if (activeAlert?.type === 'critical' || consumptionStatus === 'Critical') return 'Critical';
    if (activeAlert?.type === 'warning' || consumptionStatus === 'High') return 'High';
    return 'Normal';
}
