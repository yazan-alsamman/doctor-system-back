import { addDays, addMinutes } from 'date-fns';
import { AppointmentStatus, Prisma } from '@prisma/client';
import type { SeedConfig } from '../core/types';
import type { DoctorWorkloadProfile, PatientBehavior } from '../core/types';
import type { Rng } from '../core/rng';
import {
  combinedDayMultiplier,
  activeScenariosForTenant,
  seasonalMonthFactor,
  weekdayLoadFactor,
  type ScenarioContext,
} from '../scenarios/scenarios';
import {
  combineDayAndHHMM,
  endFromStart,
  minutesSinceMidnight,
  overlaps,
  stripTime,
} from '../utils/time';
import { money } from '../utils/money';
import { seededUuid } from '../utils/uuid';
import { SEED_ENGINE_MARK } from '../constants/ids';

const SLOT_STEP_MIN = 15;

export interface ScheduleRow {
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
}

export interface SimService {
  id: string;
  doctorId: string;
  durationMinutes: number;
  price: Prisma.Decimal;
  category: string;
  popularity: number;
}

export interface SimDoctor {
  id: string;
  workload: DoctorWorkloadProfile;
}

export interface SimPatient {
  id: string;
  behavior: PatientBehavior;
}

export interface BuiltAppointment {
  row: Prisma.AppointmentCreateManyInput;
  zone: 'past' | 'today' | 'future';
}

function scheduleForDoctor(schedules: ScheduleRow[], doctorId: string, dow: number): ScheduleRow | undefined {
  return schedules.find((s) => s.doctorId === doctorId && s.dayOfWeek === dow);
}

function withinWorkingBounds(
  tMin: number,
  durMin: number,
  workStart: number,
  workEnd: number,
  brk: [number, number] | null,
): boolean {
  const endMin = tMin + durMin;
  if (tMin < workStart || endMin > workEnd) return false;
  if (brk) {
    const [bs, be] = brk;
    if (tMin < be && endMin > bs) return false;
  }
  return true;
}

function occKey(doctorId: string, day: Date): string {
  const d = stripTime(day);
  return `${doctorId}|${d.toISOString().slice(0, 10)}`;
}

export function simulateAppointments(args: {
  tenantId: string;
  tenantSlug: string;
  rng: Rng;
  config: SeedConfig;
  anchor: Date;
  doctors: SimDoctor[];
  services: SimService[];
  schedules: ScheduleRow[];
  patients: SimPatient[];
  apptCounterStart: number;
  blockedDoctorDays?: Set<string>;
}): BuiltAppointment[] {
  const {
    tenantId,
    tenantSlug,
    rng,
    config,
    anchor,
    doctors,
    services,
    schedules,
    patients,
    apptCounterStart,
    blockedDoctorDays,
  } = args;

  const svcByDoctor = new Map<string, SimService[]>();
  for (const s of services) {
    const arr = svcByDoctor.get(s.doctorId) ?? [];
    arr.push(s);
    svcByDoctor.set(s.doctorId, arr);
  }

  const occupied = new Map<string, { start: Date; end: Date }[]>();
  const visitCounts = new Map<string, number>();
  const out: BuiltAppointment[] = [];

  const scenarios = activeScenariosForTenant(config.seed, tenantSlug);
  const scenCtx: ScenarioContext = { rng, config };

  const today0 = stripTime(anchor);
  let apptSeq = apptCounterStart;

  const pickDoctorWeighted = (): SimDoctor | null => {
    if (!doctors.length) return null;
    const weights = doctors.map((d) => 0.15 + d.workload.popularity);
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * sum;
    for (let i = 0; i < doctors.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return doctors[i]!;
    }
    return doctors[doctors.length - 1]!;
  };

  const pickService = (docId: string): SimService | null => {
    const list = svcByDoctor.get(docId) ?? [];
    if (!list.length) return null;
    const doc = doctors.find((d) => d.id === docId);
    const rev = doc?.workload.revenuePerformance ?? 0.5;
    const weights = list.map((s) => (0.05 + s.popularity) * (0.6 + rev * 0.8));
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * sum;
    for (let i = 0; i < list.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return list[i]!;
    }
    return list[list.length - 1]!;
  };

  const pickPatient = (zone: 'past' | 'today' | 'future'): SimPatient => {
    const weights = patients.map((p) => {
      const visits = visitCounts.get(p.id) ?? 0;
      const loyalty = 1 + Math.min(visits, 12) * 0.12;
      const punctual =
        zone === 'future'
          ? 1.1 - p.behavior.noShowTendency
          : 0.85 + p.behavior.paymentReliability * 0.35;
      return loyalty * punctual * (p.behavior.vip ? 1.35 : 1);
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * sum;
    for (let i = 0; i < patients.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return patients[i]!;
    }
    return patients[patients.length - 1]!;
  };

  const tryPlaceSlot = (
    day: Date,
    doctorId: string,
    duration: number,
    emergency: boolean,
  ): { start: Date; end: Date } | null => {
    const dow = day.getDay();
    const sch = scheduleForDoctor(schedules, doctorId, dow);
    if (!sch) return null;
    const dayStart = combineDayAndHHMM(day, sch.startTime);
    const dayEnd = combineDayAndHHMM(day, sch.endTime);
    const workStart = minutesSinceMidnight(dayStart);
    const workEnd = minutesSinceMidnight(dayEnd);
    let brk: [number, number] | null = null;
    if (sch.breakStart && sch.breakEnd) {
      brk = [
        minutesSinceMidnight(combineDayAndHHMM(day, sch.breakStart)),
        minutesSinceMidnight(combineDayAndHHMM(day, sch.breakEnd)),
      ];
    }

    const key = occKey(doctorId, day);
    const intervals = occupied.get(key) ?? [];

    const candidates: number[] = [];
    for (let m = workStart; m <= workEnd - duration; m += SLOT_STEP_MIN) {
      if (!withinWorkingBounds(m, duration, workStart, workEnd, brk)) continue;
      candidates.push(m);
    }
    rng.shuffleInPlace(candidates);

    for (const m of candidates) {
      const start = addMinutes(stripTime(day), m);
      const end = endFromStart(start, duration);
      if (emergency) return { start, end };
      const clash = intervals.some((iv) => overlaps(start, end, iv.start, iv.end));
      if (!clash) return { start, end };
    }
    return null;
  };

  const pushInterval = (doctorId: string, day: Date, start: Date, end: Date) => {
    const key = occKey(doctorId, day);
    const arr = occupied.get(key) ?? [];
    arr.push({ start, end });
    occupied.set(key, arr);
  };

  const zoneForDay = (day: Date): 'past' | 'today' | 'future' => {
    const d0 = stripTime(day).getTime();
    const t0 = today0.getTime();
    if (d0 < t0) return 'past';
    if (d0 > t0) return 'future';
    return 'today';
  };

  const pickStatus = (zone: 'past' | 'today' | 'future', pat: SimPatient, doc: SimDoctor): AppointmentStatus => {
    const ns =
      zone === 'past'
        ? pat.behavior.noShowTendency * 1.1 + doc.workload.noShowP * 0.35
        : pat.behavior.noShowTendency * 0.85;
    if (zone === 'past') {
      const r = rng.next();
      if (r < 0.56) return AppointmentStatus.paid;
      if (r < 0.74) return AppointmentStatus.completed;
      if (r < 0.82) return AppointmentStatus.cancelled;
      if (r < 0.82 + Math.min(0.14, ns)) return AppointmentStatus.no_show;
      if (r < 0.93) return AppointmentStatus.paid;
      return AppointmentStatus.completed;
    }
    if (zone === 'today') {
      const r = rng.next();
      if (r < 0.18) return AppointmentStatus.paid;
      if (r < 0.28) return AppointmentStatus.completed;
      if (r < 0.38) return AppointmentStatus.in_consultation;
      if (r < 0.55) return AppointmentStatus.arrived;
      if (r < 0.78) return AppointmentStatus.confirmed;
      if (r < 0.83) return AppointmentStatus.cancelled;
      if (r < 0.83 + Math.min(0.12, ns)) return AppointmentStatus.no_show;
      return AppointmentStatus.scheduled;
    }
    const r = rng.next();
    if (r < 0.52) return AppointmentStatus.scheduled;
    if (r < 0.88) return AppointmentStatus.confirmed;
    if (r < 0.93) return AppointmentStatus.cancelled;
    return AppointmentStatus.scheduled;
  };

  for (let offset = -config.historicalDays; offset <= config.futureDays; offset++) {
    const day = addDays(today0, offset);
    const dow = day.getDay();
    const wf = weekdayLoadFactor(dow);
    if (wf === 0) continue;

    const zone = zoneForDay(day);
    const scen = combinedDayMultiplier(day, scenarios, scenCtx);
    const seasonal = seasonalMonthFactor(day);
    const doctorFactor = Math.sqrt(Math.max(1, doctors.length) / 3);

    let target = Math.round(
      config.avgAppointmentsPerDay *
        config.clinicLoadFactor *
        wf *
        scen *
        seasonal *
        doctorFactor *
        (0.82 + rng.next() * 0.38),
    );

    if (zone === 'today') target = Math.round(target * 1.08);
    if (zone === 'future') target = Math.round(target * (0.72 + rng.next() * 0.2));

    target = Math.max(target, zone === 'past' ? 6 : 4);

    let placed = 0;
    let tries = 0;
    const maxTries = Math.min(target * 25, 6000);

    while (placed < target && tries < maxTries) {
      tries++;
      const doc = pickDoctorWeighted();
      if (!doc) break;
      if (blockedDoctorDays?.has(occKey(doc.id, day))) continue;

      const svc = pickService(doc.id);
      if (!svc) continue;

      const dur = Math.max(
        SLOT_STEP_MIN,
        Math.round(svc.durationMinutes * doc.workload.avgConsultMinutesFactor),
      );

      const emergency = rng.bernoulli(0.012);
      const slot = tryPlaceSlot(day, doc.id, dur, emergency);
      if (!slot) continue;

      const patient = pickPatient(zone);
      visitCounts.set(patient.id, (visitCounts.get(patient.id) ?? 0) + 1);

      let start = slot.start;
      if (rng.bernoulli(0.14)) {
        start = addMinutes(
          start,
          rng.nextInt(0, Math.min(12, Math.round(patient.behavior.lateMinutesMean / 3))),
        );
      }
      const end = endFromStart(start, dur);

      const status = pickStatus(zone, patient, doc);

      const baseNum = Number(svc.price.toString());
      let discount = 0;
      if (
        status === AppointmentStatus.paid ||
        status === AppointmentStatus.completed ||
        status === AppointmentStatus.arrived ||
        status === AppointmentStatus.in_consultation
      ) {
        if (patient.behavior.vip && rng.bernoulli(0.22)) {
          discount = Math.round((baseNum * (0.05 + rng.next() * 0.12)) / 1000) * 1000;
        } else if (rng.bernoulli(0.11)) {
          discount = Math.round((baseNum * rng.next() * 0.08) / 1000) * 1000;
        }
      }

      const finalAmt = Math.max(0, baseNum - discount);
      const overbooked = emergency || rng.bernoulli(0.028);

      const id = seededUuid(`appt:${tenantId}`, apptSeq++);

      const notesParts = [
        `${SEED_ENGINE_MARK}`,
        `slot:${zone}`,
        patient.behavior.vip ? 'VIP' : null,
        status === AppointmentStatus.cancelled ? 'cancel-chain' : null,
      ].filter(Boolean);

      const row: Prisma.AppointmentCreateManyInput = {
        id,
        tenantId,
        patientId: patient.id,
        doctorId: doc.id,
        serviceId: svc.id,
        baseTotal: svc.price,
        discount: money(discount),
        finalTotal: money(finalAmt),
        status,
        startTime: start,
        endTime: end,
        overbooked,
        notes: notesParts.join(' · '),
      };

      out.push({ row, zone });
      pushInterval(doc.id, day, start, end);
      placed++;
    }
  }

  return out;
}
