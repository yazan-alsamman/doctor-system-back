"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clinicCalendarToday = clinicCalendarToday;
exports.resolveToolParams = resolveToolParams;
const date_fns_1 = require("date-fns");
const date_fns_tz_1 = require("date-fns-tz");
function clinicTimeZone() {
    return process.env.CLINIC_TIMEZONE?.trim() || 'Asia/Riyadh';
}
function clinicCalendarToday(d = new Date()) {
    return calendarDateInZone(d, clinicTimeZone());
}
function calendarDateInZone(date, timeZone) {
    return (0, date_fns_tz_1.formatInTimeZone)(date, timeZone, 'yyyy-MM-dd');
}
function utcBoundsForCalendarDay(ymd, timeZone) {
    const start = (0, date_fns_tz_1.fromZonedTime)(`${ymd}T00:00:00`, timeZone);
    const end = (0, date_fns_tz_1.fromZonedTime)(`${ymd}T23:59:59.999`, timeZone);
    return { from: start.toISOString(), to: end.toISOString() };
}
function resolveToolParams(dto, intent) {
    const input = dto.input;
    const tz = clinicTimeZone();
    const isListingQuery = /كم|عدد|قائمة|اعرض|أظهر|ما مواعيد|list|show|how many|count/i.test(input);
    let from = dto.context?.dateRange?.from;
    let to = dto.context?.dateRange?.to;
    if (!from && !to) {
        const todayYmd = calendarDateInZone(new Date(), tz);
        if (/اليوم|today/i.test(input)) {
            const b = utcBoundsForCalendarDay(todayYmd, tz);
            from = b.from;
            to = b.to;
        }
        else if (/غداً|غدا|غدًا|بكره|بكرا|tomorrow/i.test(input)) {
            const ymd = (0, date_fns_1.format)((0, date_fns_1.addDays)((0, date_fns_1.parseISO)(todayYmd), 1), 'yyyy-MM-dd');
            const b = utcBoundsForCalendarDay(ymd, tz);
            from = b.from;
            to = b.to;
        }
        else if (/أمس|البارحة|امس|yesterday/i.test(input)) {
            const ymd = (0, date_fns_1.format)((0, date_fns_1.addDays)((0, date_fns_1.parseISO)(todayYmd), -1), 'yyyy-MM-dd');
            const b = utcBoundsForCalendarDay(ymd, tz);
            from = b.from;
            to = b.to;
        }
        else if (/هذا الأسبوع|this week|الأسبوع الحالي/i.test(input)) {
            const startYmd = todayYmd;
            const endYmd = (0, date_fns_1.format)((0, date_fns_1.addDays)((0, date_fns_1.parseISO)(startYmd), 6), 'yyyy-MM-dd');
            from = utcBoundsForCalendarDay(startYmd, tz).from;
            to = utcBoundsForCalendarDay(endYmd, tz).to;
        }
        else if (/هذا الشهر|this month|الشهر الحالي/i.test(input)) {
            const [yStr, mStr] = todayYmd.split('-');
            const y = Number(yStr);
            const m = Number(mStr);
            const firstYmd = `${yStr}-${mStr}-01`;
            const lastDay = new Date(y, m, 0).getDate();
            const lastYmd = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
            from = utcBoundsForCalendarDay(firstYmd, tz).from;
            to = utcBoundsForCalendarDay(lastYmd, tz).to;
        }
        else if (intent.intent === 'scheduling' &&
            isListingQuery &&
            /موعد|مواعيد|appointment/i.test(input)) {
            const b = utcBoundsForCalendarDay(todayYmd, tz);
            from = b.from;
            to = b.to;
        }
        else {
            const entYmd = intent.entities.date?.trim();
            if ((intent.intent === 'scheduling' || intent.intent === 'search') &&
                entYmd &&
                /^\d{4}-\d{2}-\d{2}$/.test(entYmd)) {
                const b = utcBoundsForCalendarDay(entYmd, tz);
                from = b.from;
                to = b.to;
            }
        }
    }
    return {
        patientId: dto.context?.patientId ?? intent.entities.patientId,
        doctorId: dto.context?.doctorId ?? intent.entities.doctorId,
        from,
        to,
        patientName: intent.entities.patientName,
        doctorName: intent.entities.doctorName,
        searchQuery: intent.entities.searchQuery ?? dto.input,
        invoiceStatus: intent.entities.invoiceStatus,
        status: intent.entities.invoiceStatus,
        isListingQuery,
    };
}
//# sourceMappingURL=copilot-params.builder.js.map