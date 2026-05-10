"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClinicTimezone = getClinicTimezone;
exports.toLocalMinutes = toLocalMinutes;
exports.startOfDayInTimezone = startOfDayInTimezone;
function getClinicTimezone() {
    return process.env.CLINIC_TIMEZONE?.trim() || 'UTC';
}
function toLocalMinutes(date, timezone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return h * 60 + m;
}
function startOfDayInTimezone(dateStr, timezone) {
    const noonUtc = new Date(`${dateStr}T12:00:00.000Z`);
    const noonParts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(noonUtc);
    const localH = Number(noonParts.find((p) => p.type === 'hour')?.value ?? 12) % 24;
    const localM = Number(noonParts.find((p) => p.type === 'minute')?.value ?? 0);
    const offsetMinutes = localH * 60 + localM - 720;
    const midnightUtcMs = new Date(`${dateStr}T00:00:00.000Z`).getTime();
    return new Date(midnightUtcMs - offsetMinutes * 60_000);
}
//# sourceMappingURL=timezone.util.js.map