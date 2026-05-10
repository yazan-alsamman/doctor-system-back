import type {
  AppointmentStatus,
  InvoiceStatus,
  PatientRecordStatus,
  PatientSex,
  PaymentMethod,
  Plan,
  Prisma,
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from '@prisma/client';

/** Scale preset — override granular fields via env. */
export type SeedScalePreset = 'SMALL' | 'MEDIUM' | 'LARGE';

export interface SeedConfig {
  seed: number;
  scale: SeedScalePreset;
  /** Target patient count (clamped by preset bounds). */
  patientsPerPrimaryTenant: number;
  /** Doctors per primary clinic (minimum 3). */
  doctors: number;
  historicalDays: number;
  futureDays: number;
  /** Baseline appointments attempted per clinic per weekday before popularity/load tweaks. */
  avgAppointmentsPerDay: number;
  /** Multiplier on slot-fill aggression (0.5–1.8). */
  clinicLoadFactor: number;
  revenueMultiplier: number;
  realisticMode: boolean;
  /** Extra clinic tenants (beyond primary Sham ID). */
  extraTenantCount: number;
  /** Patients per extra tenant (fraction of primary). */
  extraTenantPatientRatio: number;
}

export interface SeedContext {
  prisma: Prisma.TransactionClient;
  config: SeedConfig;
}

export interface DoctorWorkloadProfile {
  avgConsultMinutesFactor: number; // × service duration
  popularity: number; // 0–1, affects booking preference
  cancellationP: number;
  noShowP: number;
  delayMinutesMean: number;
  revenuePerformance: number; // 0–1 weight for high-ticket services
}

export interface PatientBehavior {
  noShowTendency: number;
  lateMinutesMean: number;
  paymentReliability: number; // 0–1 pay on time
  preferredHour: number; // 0–23 local
  preferredDoctorIndex: number | null; // index into tenant doctors
  vip: boolean;
}

export interface ServiceTemplate {
  name: string;
  category: string;
  priceSyp: number;
  durationMinutes: number;
  aliases: string[];
  aiKeywords: string[];
  popularity: number;
  discountable: boolean;
  packageEligible: boolean;
}

export interface GeneratedAppointment {
  tenantId: string;
  patientId: string;
  doctorId: string;
  serviceId: string;
  baseTotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  finalTotal: Prisma.Decimal;
  status: AppointmentStatus;
  startTime: Date;
  endTime: Date;
  overbooked: boolean;
  notes: string | null;
  /** Parallel arrays / structs for invoice pairing */
  lifecycle: AppointmentLifecycleMeta;
}

export interface AppointmentLifecycleMeta {
  confirmedAt?: Date;
  arrivedAt?: Date;
  consultStartAt?: Date;
  completedAt?: Date;
  paidAt?: Date;
  cancelledAt?: Date;
}

export interface InvoicePlanRow {
  tenantId: string;
  patientId: string;
  appointmentKey: string;
  totalAmount: Prisma.Decimal;
  discount: Prisma.Decimal;
  finalAmount: Prisma.Decimal;
  status: InvoiceStatus;
  totalPaid: Prisma.Decimal;
  balance: Prisma.Decimal;
}

export interface PaymentPlanRow {
  tenantId: string;
  invoiceKey: string;
  amount: Prisma.Decimal;
  method: PaymentMethod;
  reference?: string;
}

export type TenantBlueprint = {
  id: string;
  name: string;
  status: TenantStatus;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  nextBillingDate?: Date;
};
