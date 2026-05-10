import { AppointmentStatus, PatientSex, type Patient } from '@prisma/client';

const LOCALE_AR = 'ar-SY-u-ca-gregory-nu-latn';

export type PatientMedicationRow = { name: string; note?: string };

export type PatientVitals = { bp: string; hr: number; spo2: number };

export type PatientView = {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  notes: string | null;
  dob: string | null;
  sex: 'male' | 'female';
  sexLabel: string;
  bloodType: string;
  status: 'new' | 'active' | 'inactive';
  age: number;
  allergies: string[];
  meds: PatientMedicationRow[];
  vitals: PatientVitals;
  lastVisit: string;
  nextAppointment: string;
  createdAt: string;
  updatedAt: string;
};

const SEX_AR: Record<PatientSex, string> = {
  [PatientSex.male]: 'ذكر',
  [PatientSex.female]: 'أنثى',
};

const DEFAULT_VITALS: PatientVitals = { bp: '120/80', hr: 72, spo2: 98 };

function sameLocalCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function formatTimeAr(d: Date): string {
  const hour = d.getHours();
  const minute = d.getMinutes();
  const period = hour >= 12 ? 'م' : 'ص';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

function formatScheduleLabel(d: Date | null, now: Date): string {
  if (!d || Number.isNaN(d.getTime())) return '—';
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

export function computeAgeYears(dob: Date | null, ageYears: number | null, now = new Date()): number {
  if (dob && !Number.isNaN(dob.getTime())) {
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return Math.max(0, age);
  }
  return ageYears ?? 0;
}

function parseVitals(raw: unknown): PatientVitals {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_VITALS };
  const o = raw as Record<string, unknown>;
  const bp = typeof o.bp === 'string' ? o.bp : DEFAULT_VITALS.bp;
  const hr = typeof o.hr === 'number' ? o.hr : Number(o.hr) || DEFAULT_VITALS.hr;
  const spo2 = typeof o.spo2 === 'number' ? o.spo2 : Number(o.spo2) || DEFAULT_VITALS.spo2;
  return { bp, hr, spo2 };
}

function parseMedications(raw: unknown): PatientMedicationRow[] {
  if (!Array.isArray(raw)) return [];
  const out: PatientMedicationRow[] = [];
  for (const row of raw) {
    if (row && typeof row === 'object' && 'name' in row && typeof (row as { name: unknown }).name === 'string') {
      const name = (row as { name: string }).name.trim();
      if (!name) continue;
      const note =
        'note' in row && typeof (row as { note: unknown }).note === 'string'
          ? (row as { note: string }).note
          : undefined;
      out.push({ name, note });
    }
  }
  return out;
}

type ApptRow = { patientId: string; startTime: Date; status: AppointmentStatus };

export function buildScheduleForPatients(
  patientIds: string[],
  appts: ApptRow[],
  now: Date,
): Map<string, { last: Date | null; next: Date | null }> {
  const map = new Map<string, { last: Date | null; next: Date | null }>();
  for (const id of patientIds) {
    map.set(id, { last: null, next: null });
  }
  const skipNext: AppointmentStatus[] = [AppointmentStatus.cancelled, AppointmentStatus.no_show];
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

export function toPatientView(
  p: Patient,
  schedule: { last: Date | null; next: Date | null },
  now: Date,
): PatientView {
  const status = p.recordStatus as PatientView['status'];
  const allergies = Array.isArray(p.allergies) ? p.allergies : [];
  return {
    id: p.id,
    tenantId: p.tenantId,
    name: p.name,
    phone: p.phone,
    notes: p.notes,
    dob: p.dob ? p.dob.toISOString() : null,
    sex: p.sex === PatientSex.female ? 'female' : 'male',
    sexLabel: SEX_AR[p.sex] ?? SEX_AR[PatientSex.male],
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
