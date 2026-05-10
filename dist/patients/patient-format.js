"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeAgeYears = computeAgeYears;
exports.buildScheduleForPatients = buildScheduleForPatients;
exports.toPatientView = toPatientView;
const client_1 = require("@prisma/client");
const LOCALE_AR = 'ar-SY-u-ca-gregory-nu-latn';
const SEX_AR = {
    [client_1.PatientSex.male]: 'ذكر',
    [client_1.PatientSex.female]: 'أنثى',
};
const DEFAULT_VITALS = { bp: '120/80', hr: 72, spo2: 98 };
function sameLocalCalendarDay(a, b) {
    return (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());
}
function formatTimeAr(d) {
    const hour = d.getHours();
    const minute = d.getMinutes();
    const period = hour >= 12 ? 'م' : 'ص';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}
function formatScheduleLabel(d, now) {
    if (!d || Number.isNaN(d.getTime()))
        return '—';
    const timePart = formatTimeAr(d);
    if (sameLocalCalendarDay(d, now)) {
        return `اليوم · ${timePart}`;
    }
    const datePart = new Intl.DateTimeFormat(LOCALE_AR, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(d);
    return `${datePart} · ${timePart}`;
}
function computeAgeYears(dob, ageYears, now = new Date()) {
    if (dob && !Number.isNaN(dob.getTime())) {
        let age = now.getFullYear() - dob.getFullYear();
        const m = now.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < dob.getDate()))
            age--;
        return Math.max(0, age);
    }
    return ageYears ?? 0;
}
function parseVitals(raw) {
    if (!raw || typeof raw !== 'object')
        return { ...DEFAULT_VITALS };
    const o = raw;
    const bp = typeof o.bp === 'string' ? o.bp : DEFAULT_VITALS.bp;
    const hr = typeof o.hr === 'number' ? o.hr : Number(o.hr) || DEFAULT_VITALS.hr;
    const spo2 = typeof o.spo2 === 'number' ? o.spo2 : Number(o.spo2) || DEFAULT_VITALS.spo2;
    return { bp, hr, spo2 };
}
function parseMedications(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const row of raw) {
        if (row && typeof row === 'object' && 'name' in row && typeof row.name === 'string') {
            const name = row.name.trim();
            if (!name)
                continue;
            const note = 'note' in row && typeof row.note === 'string'
                ? row.note
                : undefined;
            out.push({ name, note });
        }
    }
    return out;
}
function buildScheduleForPatients(patientIds, appts, now) {
    const map = new Map();
    for (const id of patientIds) {
        map.set(id, { last: null, next: null });
    }
    const skipNext = [client_1.AppointmentStatus.cancelled, client_1.AppointmentStatus.no_show];
    for (const id of patientIds) {
        const mine = appts.filter((a) => a.patientId === id);
        const past = mine.filter((a) => a.startTime < now);
        const future = mine.filter((a) => a.startTime >= now && !skipNext.includes(a.status));
        const last = past.length ? new Date(Math.max(...past.map((a) => a.startTime.getTime()))) : null;
        const next = future.length ? new Date(Math.min(...future.map((a) => a.startTime.getTime()))) : null;
        map.set(id, { last, next });
    }
    return map;
}
function toPatientView(p, schedule, now) {
    const status = p.recordStatus;
    const allergies = Array.isArray(p.allergies) ? p.allergies : [];
    return {
        id: p.id,
        tenantId: p.tenantId,
        name: p.name,
        phone: p.phone,
        notes: p.notes,
        dob: p.dob ? p.dob.toISOString() : null,
        sex: p.sex === client_1.PatientSex.female ? 'female' : 'male',
        sexLabel: SEX_AR[p.sex] ?? SEX_AR[client_1.PatientSex.male],
        bloodType: p.bloodType || 'O+',
        status,
        age: computeAgeYears(p.dob, p.ageYears, now),
        allergies,
        meds: parseMedications(p.medications),
        vitals: parseVitals(p.vitals),
        lastVisit: formatScheduleLabel(schedule.last, now),
        nextAppointment: formatScheduleLabel(schedule.next, now),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
    };
}
//# sourceMappingURL=patient-format.js.map