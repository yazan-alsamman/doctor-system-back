import * as bcrypt from 'bcrypt';
import { Prisma, UserRole } from '@prisma/client';
import type { DoctorWorkloadProfile } from '../core/types';
import type { Rng } from '../core/rng';

export interface DoctorFactoryExtras {
  workload: DoctorWorkloadProfile;
  specialtyTag: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function synthesizeDoctorWorkload(rng: Rng): DoctorWorkloadProfile {
  return {
    avgConsultMinutesFactor: Math.min(1.35, Math.max(0.82, 1 + rng.nextGaussian(0, 0.08))),
    popularity: Math.min(0.98, Math.max(0.35, rng.nextGaussian(0.62, 0.14))),
    cancellationP: Math.min(0.22, Math.max(0.03, rng.nextGaussian(0.09, 0.04))),
    noShowP: Math.min(0.18, Math.max(0.04, rng.nextGaussian(0.1, 0.03))),
    delayMinutesMean: Math.max(0, rng.nextGaussian(8, 6)),
    revenuePerformance: Math.min(0.98, Math.max(0.25, rng.nextGaussian(0.58, 0.16))),
  };
}

const DOC_TITLES = [
  'اختصاص جلدية وليزر',
  'اختصاص أسنان تجميلية',
  'تجميل غير جراحي — حقن وفيلر',
  'أخصائي أمراض جلدية',
  'طبيب أسنان عام — تركيبات تجميلية',
  'جراحة فكين — استشارات',
];

export function createDoctorUser(args: {
  tenantId: string;
  email: string;
  name: string;
  code: string;
  passwordHash: string;
  title: string;
  overrides?: Partial<Prisma.UserCreateManyInput>;
}): Prisma.UserCreateManyInput {
  return {
    tenantId: args.tenantId,
    email: args.email,
    name: args.name,
    title: args.title,
    doctorCode: args.code,
    passwordHash: args.passwordHash,
    role: UserRole.doctor,
    active: true,
    ...args.overrides,
  };
}

export function pickDoctorTitle(rng: Rng): string {
  return rng.pick(DOC_TITLES);
}

export function createStaffUser(args: {
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  title?: string;
  overrides?: Partial<Prisma.UserCreateManyInput>;
}): Prisma.UserCreateManyInput {
  return {
    tenantId: args.tenantId,
    email: args.email,
    name: args.name,
    title: args.title ?? null,
    passwordHash: args.passwordHash,
    role: args.role,
    active: true,
    ...args.overrides,
  };
}
