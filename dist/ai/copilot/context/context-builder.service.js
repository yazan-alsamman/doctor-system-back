"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ContextBuilderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextBuilderService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const CACHE_TTL_MS = 60_000;
const MAX_CONTEXT_CHARS = 5_000;
const APPT_STATUS_AR = {
    scheduled: 'مجدول',
    confirmed: 'مؤكد',
    arrived: 'وصل',
    in_consultation: 'في الكشف',
    completed: 'مكتمل',
    paid: 'مدفوع',
    no_show: 'لم يحضر',
    cancelled: 'ملغى',
};
const INV_STATUS_AR = {
    draft: 'معلق (غير مدفوع)',
    partial: 'مدفوع جزئياً',
    paid: 'مدفوع بالكامل',
};
const PKG_STATUS_AR = {
    active: 'نشط',
    completed: 'مكتمل',
    expired: 'منتهي',
};
const DAY_AR = {
    0: 'الأحد',
    1: 'الاثنين',
    2: 'الثلاثاء',
    3: 'الأربعاء',
    4: 'الخميس',
    5: 'الجمعة',
    6: 'السبت',
};
function fmtTime(iso) {
    if (!iso)
        return '—';
    try {
        const d = new Date(String(iso));
        if (Number.isNaN(d.getTime()))
            return '—';
        return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    catch {
        return '—';
    }
}
function fmtDate(iso) {
    if (!iso)
        return '—';
    try {
        const d = new Date(String(iso));
        if (Number.isNaN(d.getTime()))
            return '—';
        return d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
    catch {
        return '—';
    }
}
function fmtAmount(n) {
    const num = Number(n ?? 0);
    return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}
function asArray(v) {
    return Array.isArray(v) ? v : v != null ? [v] : [];
}
function strOf(v, fallback = '—') {
    if (v == null || v === '')
        return fallback;
    return String(v);
}
function fmtAppointmentList(rows) {
    if (!rows.length)
        return 'لا توجد مواعيد.';
    const lines = rows.map((r, i) => {
        const a = r;
        const patient = a.patient?.name ?? a.patientId ?? '—';
        const doctor = a.doctor?.name ?? a.doctorId ?? '—';
        const service = a.service?.name ?? a.serviceId ?? '—';
        const status = APPT_STATUS_AR[String(a.status ?? '')] ?? String(a.status ?? '—');
        const time = `${fmtTime(a.startTime)}–${fmtTime(a.endTime)}`;
        const date = fmtDate(a.startTime);
        return `${i + 1}. ${date} | ${time} | مريض: ${patient} | طبيب: ${doctor} | خدمة: ${service} | الحالة: ${status}`;
    });
    return lines.join('\n');
}
function fmtPatientList(rows) {
    if (!rows.length)
        return 'لا توجد نتائج.';
    return rows.map((r, i) => {
        const p = r;
        const status = p.recordStatus === 'active' ? 'نشط' : p.recordStatus === 'inactive' ? 'غير نشط' : 'جديد';
        return `${i + 1}. ${strOf(p.name)} | هاتف: ${strOf(p.phone)} | الحالة: ${status} | فصيلة: ${strOf(p.bloodType, 'غير محدد')}`;
    }).join('\n');
}
function fmtInvoiceList(rows) {
    if (!rows.length)
        return 'لا توجد فواتير.';
    return rows.map((r, i) => {
        const inv = r;
        const patient = inv.patient?.name ?? '—';
        const status = INV_STATUS_AR[String(inv.status ?? '')] ?? String(inv.status ?? '—');
        const total = fmtAmount(inv.finalAmount ?? inv.totalAmount);
        const balance = fmtAmount(inv.balance);
        const date = fmtDate(inv.createdAt);
        return `${i + 1}. ${patient} | الإجمالي: ${total} | المتبقي: ${balance} | الحالة: ${status} | التاريخ: ${date}`;
    }).join('\n');
}
function fmtSearchAppointments(data) {
    const rows = asArray(data);
    return `المواعيد (${rows.length}):\n${fmtAppointmentList(rows)}`;
}
function fmtSearchPatients(data) {
    const rows = asArray(data);
    return `المرضى (${rows.length}):\n${fmtPatientList(rows)}`;
}
function fmtSearchInvoices(data) {
    const rows = asArray(data);
    return `الفواتير (${rows.length}):\n${fmtInvoiceList(rows)}`;
}
function fmtGetAvailableSlots(data) {
    const d = data;
    const schedules = asArray(d.schedules);
    const booked = asArray(d.bookedSlots);
    const lines = [];
    if (schedules.length) {
        lines.push('جداول الأطباء:');
        for (const s of schedules) {
            const sc = s;
            const name = sc.doctor?.name ?? sc.doctorId ?? '—';
            const day = DAY_AR[Number(sc.dayOfWeek)] ?? String(sc.dayOfWeek);
            lines.push(`  ${name}: ${day} | ${strOf(sc.startTime)}–${strOf(sc.endTime)}`);
        }
    }
    if (booked.length) {
        lines.push(`\nالأوقات المحجوزة (${booked.length}):`);
        for (const b of booked.slice(0, 20)) {
            const bk = b;
            lines.push(`  ${fmtTime(bk.startTime)}–${fmtTime(bk.endTime)} | ${strOf(bk.status, '')}`);
        }
        if (booked.length > 20)
            lines.push(`  ... و${booked.length - 20} آخرون`);
    }
    return lines.join('\n') || 'لا توجد بيانات جداول.';
}
function fmtGetDoctorSchedule(data) {
    const rows = asArray(data);
    if (!rows.length)
        return 'لا يوجد جدول مسجّل للطبيب.';
    return rows.map((s) => {
        const sc = s;
        const name = sc.doctor?.name ?? sc.doctorId ?? '—';
        const day = DAY_AR[Number(sc.dayOfWeek)] ?? String(sc.dayOfWeek);
        const brk = sc.breakStart ? ` | استراحة: ${strOf(sc.breakStart)}–${strOf(sc.breakEnd)}` : '';
        return `${name}: ${day} | ${strOf(sc.startTime)}–${strOf(sc.endTime)}${brk}`;
    }).join('\n');
}
function fmtDetectConflicts(data) {
    const rows = asArray(data);
    if (!rows.length)
        return 'لا توجد تعارضات.';
    return `تعارضات (${rows.length}):\n${fmtAppointmentList(rows)}`;
}
function fmtGetPatientHistory(data) {
    const d = data;
    if (!d)
        return 'لم يُعثر على بيانات المريض.';
    const patient = d.patient;
    const appts = asArray(d.appointments);
    const invoices = asArray(d.invoices);
    const lines = [];
    if (patient) {
        const allergies = asArray(patient.allergies).join('، ') || 'لا توجد';
        lines.push(`المريض: ${strOf(patient.name)} | هاتف: ${strOf(patient.phone)} | فصيلة: ${strOf(patient.bloodType)} | حساسية: ${allergies}`);
    }
    if (appts.length) {
        lines.push(`\nآخر المواعيد (${appts.length}):`);
        lines.push(fmtAppointmentList(appts.slice(0, 10)));
    }
    else {
        lines.push('\nلا توجد مواعيد سابقة.');
    }
    if (invoices.length) {
        lines.push(`\nالفواتير (${invoices.length}):`);
        lines.push(fmtInvoiceList(invoices.slice(0, 5)));
    }
    return lines.join('\n');
}
function fmtGetPatientSummary(data) {
    const p = data;
    if (!p)
        return 'لم يُعثر على ملف المريض.';
    const appts = asArray(p.appointments);
    const allergies = asArray(p.allergies).join('، ') || 'لا توجد';
    const lines = [
        `الاسم: ${strOf(p.name)} | هاتف: ${strOf(p.phone)} | جنس: ${p.sex === 'female' ? 'أنثى' : 'ذكر'} | فصيلة: ${strOf(p.bloodType)} | حساسية: ${allergies}`,
    ];
    if (appts.length) {
        lines.push(`\nآخر ${appts.length} مواعيد:`);
        lines.push(fmtAppointmentList(appts));
    }
    return lines.join('\n');
}
function fmtGetInvoiceData(data) {
    const rows = asArray(data);
    return `الفواتير (${rows.length}):\n${fmtInvoiceList(rows)}`;
}
function fmtGetRevenueStats(data) {
    const d = data;
    const inv = asArray(d.invoiceStats);
    const appt = asArray(d.appointmentStats);
    const period = d.period;
    const lines = [];
    if (period) {
        lines.push(`الفترة: ${fmtDate(period.from)} → ${fmtDate(period.to)}`);
    }
    if (inv.length) {
        lines.push('\nإحصاءات الفواتير:');
        for (const s of inv) {
            const st = s;
            const sum = st._sum;
            const cnt = st._count?._all ?? 0;
            const statusLabel = INV_STATUS_AR[String(st.status)] ?? String(st.status);
            const collected = fmtAmount(sum?.totalPaid ?? sum?.finalAmount ?? 0);
            const outstanding = fmtAmount(sum?.balance ?? 0);
            lines.push(`  ${statusLabel}: ${cnt} فاتورة | محصّل: ${collected} | متبقي: ${outstanding}`);
        }
    }
    if (appt.length) {
        lines.push('\nإحصاءات المواعيد:');
        for (const s of appt) {
            const st = s;
            const cnt = st._count?._all ?? 0;
            const statusLabel = APPT_STATUS_AR[String(st.status)] ?? String(st.status);
            lines.push(`  ${statusLabel}: ${cnt}`);
        }
    }
    return lines.join('\n') || 'لا توجد بيانات مالية.';
}
let ContextBuilderService = ContextBuilderService_1 = class ContextBuilderService {
    logger = new common_1.Logger(ContextBuilderService_1.name);
    cache = new Map();
    buildContextString(intent, toolResults, tenantId) {
        const cacheKey = this.makeCacheKey(tenantId, intent, toolResults);
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now())
            return cached.value;
        const context = this.format(toolResults);
        this.cache.set(cacheKey, { value: context, expiresAt: Date.now() + CACHE_TTL_MS });
        this.evictStale();
        return context;
    }
    format(results) {
        if (!results.length)
            return 'لا توجد بيانات متاحة.';
        const sections = [];
        for (const result of results) {
            if (result.error || result.data === null || result.data === undefined)
                continue;
            const section = this.formatTool(result);
            if (section)
                sections.push(section);
        }
        if (!sections.length)
            return 'لا توجد بيانات متاحة.';
        const raw = sections.join('\n\n---\n\n');
        return raw.length > MAX_CONTEXT_CHARS
            ? raw.slice(0, MAX_CONTEXT_CHARS) + '\n\n[تم اختصار السياق]'
            : raw;
    }
    formatTool(result) {
        try {
            switch (result.tool) {
                case 'searchAppointments': return fmtSearchAppointments(result.data);
                case 'searchPatients': return fmtSearchPatients(result.data);
                case 'searchInvoices': return fmtSearchInvoices(result.data);
                case 'getAvailableSlots': return fmtGetAvailableSlots(result.data);
                case 'getDoctorSchedule': return fmtGetDoctorSchedule(result.data);
                case 'detectConflicts': return fmtDetectConflicts(result.data);
                case 'getPatientHistory': return fmtGetPatientHistory(result.data);
                case 'getPatientSummary': return fmtGetPatientSummary(result.data);
                case 'getInvoiceData': return fmtGetInvoiceData(result.data);
                case 'getRevenueStats': return fmtGetRevenueStats(result.data);
                default:
                    return `[${result.tool}]\n${this.slimJson(result.data)}`;
            }
        }
        catch (err) {
            this.logger.warn(`Context format error for ${result.tool}: ${String(err).slice(0, 100)}`);
            return '';
        }
    }
    slimJson(data) {
        const NOISE_KEYS = new Set([
            'id', 'tenantId', 'patientId', 'doctorId', 'serviceId', 'appointmentId', 'invoiceId',
            'createdAt', 'updatedAt', 'deletedAt', 'passwordHash', 'featureOverrides',
        ]);
        const clean = JSON.parse(JSON.stringify(data, (k, v) => (NOISE_KEYS.has(k) ? undefined : v)));
        return JSON.stringify(clean, null, 1);
    }
    makeCacheKey(tenantId, intent, results) {
        const toolNames = results.map((r) => r.tool).join(',');
        const hash = (0, crypto_1.createHash)('sha256')
            .update(JSON.stringify(results, (_k, v) => (v instanceof Date ? v.toISOString() : v)))
            .digest('hex')
            .slice(0, 32);
        return `${tenantId}:${intent}:${toolNames}:${hash}`;
    }
    evictStale() {
        if (this.cache.size <= 200)
            return;
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (entry.expiresAt <= now)
                this.cache.delete(key);
        }
    }
};
exports.ContextBuilderService = ContextBuilderService;
exports.ContextBuilderService = ContextBuilderService = ContextBuilderService_1 = __decorate([
    (0, common_1.Injectable)()
], ContextBuilderService);
//# sourceMappingURL=context-builder.service.js.map