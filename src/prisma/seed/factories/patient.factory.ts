import {
  PatientRecordStatus,
  PatientSex,
  Prisma,
} from '@prisma/client';
import type { PatientBehavior } from '../core/types';
import type { Rng } from '../core/rng';
import { composeArabicName } from '../data/arabic-names';
import { MOBILE_PREFIXES } from '../constants/clinic-calendar';

export interface PatientFactoryInput {
  tenantId: string;
  index: number;
  rng: Rng;
  id?: string;
  behavior?: PatientBehavior;
  overrides?: Partial<Prisma.PatientCreateManyInput>;
}

export function synthesizeBehavior(rng: Rng): PatientBehavior {
  const vip = rng.bernoulli(0.04);
  return {
    noShowTendency: Math.min(0.45, Math.max(0.02, rng.nextGaussian(0.12, 0.06) + (vip ? -0.03 : 0.04))),
    lateMinutesMean: Math.max(0, rng.nextGaussian(vip ? 5 : 14, 10)),
    paymentReliability: Math.min(0.99, Math.max(0.15, rng.nextGaussian(vip ? 0.92 : 0.72, 0.12))),
    preferredHour: rng.nextInt(9, 18),
    preferredDoctorIndex: rng.bernoulli(0.55) ? rng.nextInt(0, 12) : null,
    vip,
  };
}

export function createPatientRow(input: PatientFactoryInput): Prisma.PatientCreateManyInput {
  const { tenantId, index, rng, overrides, id } = input;
  const sex = rng.bernoulli(0.58) ? PatientSex.female : PatientSex.male;
  const name = composeArabicName(rng, sex === PatientSex.female ? 'female' : 'male');
  const prefix = rng.pick(MOBILE_PREFIXES);
  const phone = `${prefix}${String(1000000 + (index % 9000000)).padStart(7, '0')}`;

  const behavior = input.behavior ?? synthesizeBehavior(rng);
  const roll = rng.next();
  let recordStatus: PatientRecordStatus = PatientRecordStatus.active;
  if (roll < 0.06) recordStatus = PatientRecordStatus.new;
  else if (roll < 0.11) recordStatus = PatientRecordStatus.inactive;

  const blacklist = rng.bernoulli(0.008);
  const tags = [
    behavior.vip ? 'VIP' : null,
    blacklist ? 'BLACKLIST' : null,
    rng.bernoulli(0.07) ? 'متكرر' : null,
    rng.bernoulli(0.03) ? 'تحويل طبي' : null,
  ].filter(Boolean);

  const chronic = rng.bernoulli(0.09)
    ? ['ضغط', 'سكري', 'ربو'][rng.nextInt(0, 2)]
    : null;

  const allergies =
    rng.bernoulli(0.14) ? [['البنسلين', 'الإيبوبروفين', 'اللاتكس'][rng.nextInt(0, 2)]!] : [];

  const ageYears = Math.min(78, Math.max(14, rng.nextGaussian(34, 12)));

  const notes =
    `[seed-meta tags:${tags.join('|') || 'عادي'}]` +
    (chronic ? ` حالة مزمنة: ${chronic}.` : '') +
    (blacklist ? ' لا يُسمح بالحجز الآجل بدون مدير.' : '');

  const vitals = {
    seedBehavior: behavior,
    preferredSlotHour: behavior.preferredHour,
  } as unknown as Prisma.InputJsonValue;

  const base: Prisma.PatientCreateManyInput = {
    ...(id ? { id } : {}),
    tenantId,
    name,
    phone,
    sex,
    recordStatus,
    ageYears: Math.round(ageYears),
    allergies,
    notes,
    vitals,
    bloodType: ['O+', 'A+', 'B+', 'AB+', 'O-'][rng.nextInt(0, 4)]!,
  };

  return { ...base, ...overrides };
}
