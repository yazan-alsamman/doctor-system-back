import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { IntentType } from '../intent/intent.types';
import type { ToolResult } from '../tools/tool.types';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const MAX_CONTEXT_CHARS = 5_000;

// ─── Arabic locale helpers ─────────────────────────────────────────────────

const APPT_STATUS_AR: Record<string, string> = {
  scheduled:       'مجدول',
  confirmed:       'مؤكد',
  arrived:         'وصل',
  in_consultation: 'في الكشف',
  completed:       'مكتمل',
  paid:            'مدفوع',
  no_show:         'لم يحضر',
  cancelled:       'ملغى',
};

const INV_STATUS_AR: Record<string, string> = {
  draft:   'معلق (غير مدفوع)',
  partial: 'مدفوع جزئياً',
  paid:    'مدفوع بالكامل',
};

const PKG_STATUS_AR: Record<string, string> = {
  active:    'نشط',
  completed: 'مكتمل',
  expired:   'منتهي',
};

const DAY_AR: Record<number, string> = {
  0: 'الأحد',
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

function fmtTime(iso: unknown): string {
  if (!iso) return '—';
  try {
    const d = new Date(String(iso));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '—';
  }
}

function fmtDate(iso: unknown): string {
  if (!iso) return '—';
  try {
    const d = new Date(String(iso));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function fmtAmount(n: unknown): string {
  const num = Number(n ?? 0);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : v != null ? [v] : [];
}

function strOf(v: unknown, fallback = '—'): string {
  if (v == null || v === '') return fallback;
  return String(v);
}

// ─── Per-tool formatters ───────────────────────────────────────────────────

function fmtAppointmentList(rows: unknown[]): string {
  if (!rows.length) return 'لا توجد مواعيد.';
  const lines = rows.map((r, i) => {
    const a = r as Record<string, unknown>;
    const patient = (a.patient as Record<string, unknown>)?.name ?? a.patientId ?? '—';
    const doctor  = (a.doctor as Record<string, unknown>)?.name ?? a.doctorId  ?? '—';
    const service = (a.service as Record<string, unknown>)?.name ?? a.serviceId ?? '—';
    const status  = APPT_STATUS_AR[String(a.status ?? '')] ?? String(a.status ?? '—');
    const time    = `${fmtTime(a.startTime)}–${fmtTime(a.endTime)}`;
    const date    = fmtDate(a.startTime);
    return `${i + 1}. ${date} | ${time} | مريض: ${patient} | طبيب: ${doctor} | خدمة: ${service} | الحالة: ${status}`;
  });
  return lines.join('\n');
}

function fmtPatientList(rows: unknown[]): string {
  if (!rows.length) return 'لا توجد نتائج.';
  return rows.map((r, i) => {
    const p = r as Record<string, unknown>;
    const status = p.recordStatus === 'active' ? 'نشط' : p.recordStatus === 'inactive' ? 'غير نشط' : 'جديد';
    return `${i + 1}. ${strOf(p.name)} | هاتف: ${strOf(p.phone)} | الحالة: ${status} | فصيلة: ${strOf(p.bloodType, 'غير محدد')}`;
  }).join('\n');
}

function fmtInvoiceList(rows: unknown[]): string {
  if (!rows.length) return 'لا توجد فواتير.';
  return rows.map((r, i) => {
    const inv = r as Record<string, unknown>;
    const patient = (inv.patient as Record<string, unknown>)?.name ?? '—';
    const status  = INV_STATUS_AR[String(inv.status ?? '')] ?? String(inv.status ?? '—');
    const total   = fmtAmount(inv.finalAmount ?? inv.totalAmount);
    const balance = fmtAmount(inv.balance);
    const date    = fmtDate(inv.createdAt);
    return `${i + 1}. ${patient} | الإجمالي: ${total} | المتبقي: ${balance} | الحالة: ${status} | التاريخ: ${date}`;
  }).join('\n');
}

function fmtSearchAppointments(data: unknown): string {
  const rows = asArray(data);
  return `المواعيد (${rows.length}):\n${fmtAppointmentList(rows)}`;
}

function fmtSearchPatients(data: unknown): string {
  const rows = asArray(data);
  return `المرضى (${rows.length}):\n${fmtPatientList(rows)}`;
}

function fmtSearchInvoices(data: unknown): string {
  const rows = asArray(data);
  return `الفواتير (${rows.length}):\n${fmtInvoiceList(rows)}`;
}

function fmtGetAvailableSlots(data: unknown): string {
  const d = data as Record<string, unknown>;
  const schedules = asArray(d.schedules);
  const booked    = asArray(d.bookedSlots);
  const lines: string[] = [];

  if (schedules.length) {
    lines.push('جداول الأطباء:');
    for (const s of schedules) {
      const sc = s as Record<string, unknown>;
      const name = (sc.doctor as Record<string, unknown>)?.name ?? sc.doctorId ?? '—';
      const day  = DAY_AR[Number(sc.dayOfWeek)] ?? String(sc.dayOfWeek);
      lines.push(`  ${name}: ${day} | ${strOf(sc.startTime)}–${strOf(sc.endTime)}`);
    }
  }

  if (booked.length) {
    lines.push(`\nالأوقات المحجوزة (${booked.length}):`);
    for (const b of booked.slice(0, 20)) {
      const bk = b as Record<string, unknown>;
      lines.push(`  ${fmtTime(bk.startTime)}–${fmtTime(bk.endTime)} | ${strOf(bk.status, '')}`);
    }
    if (booked.length > 20) lines.push(`  ... و${booked.length - 20} آخرون`);
  }

  return lines.join('\n') || 'لا توجد بيانات جداول.';
}

function fmtGetDoctorSchedule(data: unknown): string {
  const rows = asArray(data);
  if (!rows.length) return 'لا يوجد جدول مسجّل للطبيب.';
  return rows.map((s) => {
    const sc   = s as Record<string, unknown>;
    const name = (sc.doctor as Record<string, unknown>)?.name ?? sc.doctorId ?? '—';
    const day  = DAY_AR[Number(sc.dayOfWeek)] ?? String(sc.dayOfWeek);
    const brk  = sc.breakStart ? ` | استراحة: ${strOf(sc.breakStart)}–${strOf(sc.breakEnd)}` : '';
    return `${name}: ${day} | ${strOf(sc.startTime)}–${strOf(sc.endTime)}${brk}`;
  }).join('\n');
}

function fmtDetectConflicts(data: unknown): string {
  const rows = asArray(data);
  if (!rows.length) return 'لا توجد تعارضات.';
  return `تعارضات (${rows.length}):\n${fmtAppointmentList(rows)}`;
}

function fmtGetPatientHistory(data: unknown): string {
  const d = data as Record<string, unknown> | null;
  if (!d) return 'لم يُعثر على بيانات المريض.';

  const patient  = d.patient as Record<string, unknown> | undefined;
  const appts    = asArray(d.appointments);
  const invoices = asArray(d.invoices);

  const lines: string[] = [];

  if (patient) {
    const allergies = asArray(patient.allergies).join('، ') || 'لا توجد';
    lines.push(
      `المريض: ${strOf(patient.name)} | هاتف: ${strOf(patient.phone)} | فصيلة: ${strOf(patient.bloodType)} | حساسية: ${allergies}`,
    );
  }

  if (appts.length) {
    lines.push(`\nآخر المواعيد (${appts.length}):`);
    lines.push(fmtAppointmentList(appts.slice(0, 10)));
  } else {
    lines.push('\nلا توجد مواعيد سابقة.');
  }

  if (invoices.length) {
    lines.push(`\nالفواتير (${invoices.length}):`);
    lines.push(fmtInvoiceList(invoices.slice(0, 5)));
  }

  return lines.join('\n');
}

function fmtGetPatientSummary(data: unknown): string {
  const p = data as Record<string, unknown> | null;
  if (!p) return 'لم يُعثر على ملف المريض.';

  const appts    = asArray(p.appointments);
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

function fmtGetInvoiceData(data: unknown): string {
  const rows = asArray(data);
  return `الفواتير (${rows.length}):\n${fmtInvoiceList(rows)}`;
}

function fmtGetRevenueStats(data: unknown): string {
  const d      = data as Record<string, unknown>;
  const inv    = asArray(d.invoiceStats);
  const appt   = asArray(d.appointmentStats);
  const period = d.period as Record<string, unknown> | undefined;

  const lines: string[] = [];

  if (period) {
    lines.push(`الفترة: ${fmtDate(period.from)} → ${fmtDate(period.to)}`);
  }

  if (inv.length) {
    lines.push('\nإحصاءات الفواتير:');
    for (const s of inv) {
      const st = s as Record<string, unknown>;
      const sum = st._sum as Record<string, unknown> | undefined;
      const cnt = (st._count as Record<string, unknown>)?._all ?? 0;
      const statusLabel = INV_STATUS_AR[String(st.status)] ?? String(st.status);
      const collected = fmtAmount(sum?.totalPaid ?? sum?.finalAmount ?? 0);
      const outstanding = fmtAmount(sum?.balance ?? 0);
      lines.push(`  ${statusLabel}: ${cnt} فاتورة | محصّل: ${collected} | متبقي: ${outstanding}`);
    }
  }

  if (appt.length) {
    lines.push('\nإحصاءات المواعيد:');
    for (const s of appt) {
      const st = s as Record<string, unknown>;
      const cnt = (st._count as Record<string, unknown>)?._all ?? 0;
      const statusLabel = APPT_STATUS_AR[String(st.status)] ?? String(st.status);
      lines.push(`  ${statusLabel}: ${cnt}`);
    }
  }

  return lines.join('\n') || 'لا توجد بيانات مالية.';
}

// ─── Service ──────────────────────────────────────────────────────────────

@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);
  private readonly cache = new Map<string, CacheEntry>();

  buildContextString(
    intent: IntentType,
    toolResults: ToolResult[],
    tenantId: string,
  ): string {
    const cacheKey = this.makeCacheKey(tenantId, intent, toolResults);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const context = this.format(toolResults);
    this.cache.set(cacheKey, { value: context, expiresAt: Date.now() + CACHE_TTL_MS });
    this.evictStale();
    return context;
  }

  private format(results: ToolResult[]): string {
    if (!results.length) return 'لا توجد بيانات متاحة.';

    const sections: string[] = [];
    for (const result of results) {
      if (result.error || result.data === null || result.data === undefined) continue;
      const section = this.formatTool(result);
      if (section) sections.push(section);
    }

    if (!sections.length) return 'لا توجد بيانات متاحة.';
    const raw = sections.join('\n\n---\n\n');
    return raw.length > MAX_CONTEXT_CHARS
      ? raw.slice(0, MAX_CONTEXT_CHARS) + '\n\n[تم اختصار السياق]'
      : raw;
  }

  private formatTool(result: ToolResult): string {
    try {
      switch (result.tool) {
        case 'searchAppointments': return fmtSearchAppointments(result.data);
        case 'searchPatients':     return fmtSearchPatients(result.data);
        case 'searchInvoices':     return fmtSearchInvoices(result.data);
        case 'getAvailableSlots':  return fmtGetAvailableSlots(result.data);
        case 'getDoctorSchedule':  return fmtGetDoctorSchedule(result.data);
        case 'detectConflicts':    return fmtDetectConflicts(result.data);
        case 'getPatientHistory':  return fmtGetPatientHistory(result.data);
        case 'getPatientSummary':  return fmtGetPatientSummary(result.data);
        case 'getInvoiceData':     return fmtGetInvoiceData(result.data);
        case 'getRevenueStats':    return fmtGetRevenueStats(result.data);
        default:
          // Fallback: slim JSON (remove noise fields)
          return `[${result.tool}]\n${this.slimJson(result.data)}`;
      }
    } catch (err) {
      this.logger.warn(`Context format error for ${result.tool}: ${String(err).slice(0, 100)}`);
      return '';
    }
  }

  private slimJson(data: unknown): string {
    // Strip UUID/timestamp fields that waste tokens
    const NOISE_KEYS = new Set([
      'id', 'tenantId', 'patientId', 'doctorId', 'serviceId', 'appointmentId', 'invoiceId',
      'createdAt', 'updatedAt', 'deletedAt', 'passwordHash', 'featureOverrides',
    ]);
    const clean = JSON.parse(
      JSON.stringify(data, (k, v) => (NOISE_KEYS.has(k) ? undefined : v)),
    ) as unknown;
    return JSON.stringify(clean, null, 1);
  }

  private makeCacheKey(tenantId: string, intent: IntentType, results: ToolResult[]): string {
    const toolNames = results.map((r) => r.tool).join(',');
    const hash = createHash('sha256')
      .update(JSON.stringify(results, (_k, v) => (v instanceof Date ? v.toISOString() : v)))
      .digest('hex')
      .slice(0, 32);
    return `${tenantId}:${intent}:${toolNames}:${hash}`;
  }

  private evictStale(): void {
    if (this.cache.size <= 200) return;
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
  }
}
