import type { SeedConfig, SeedScalePreset } from './types';

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function envFloat(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export function resolveSeedConfig(): SeedConfig {
  const raw = (process.env.SEED_SCALE || 'MEDIUM').toUpperCase();
  const scale: SeedScalePreset =
    raw === 'SMALL' || raw === 'MEDIUM' || raw === 'LARGE' ? raw : 'MEDIUM';
  const preset: Record<
    SeedScalePreset,
    Pick<
      SeedConfig,
      | 'patientsPerPrimaryTenant'
      | 'doctors'
      | 'historicalDays'
      | 'futureDays'
      | 'avgAppointmentsPerDay'
      | 'extraTenantCount'
    >
  > = {
    SMALL: {
      patientsPerPrimaryTenant: 500,
      doctors: 4,
      historicalDays: 120,
      futureDays: 30,
      avgAppointmentsPerDay: 14,
      extraTenantCount: 1,
    },
    MEDIUM: {
      patientsPerPrimaryTenant: 5000,
      doctors: 8,
      historicalDays: 180,
      futureDays: 45,
      avgAppointmentsPerDay: 22,
      extraTenantCount: 3,
    },
    LARGE: {
      patientsPerPrimaryTenant: 50000,
      doctors: 14,
      historicalDays: 180,
      futureDays: 45,
      avgAppointmentsPerDay: 38,
      extraTenantCount: 4,
    },
  };

  const p = preset[scale] ?? preset.MEDIUM;

  const patientsPerPrimaryTenant = Math.max(
    50,
    envInt('SEED_PATIENTS', p.patientsPerPrimaryTenant),
  );
  const doctors = Math.max(3, envInt('SEED_DOCTORS', p.doctors));
  const historicalDays = Math.max(30, envInt('SEED_HISTORICAL_DAYS', p.historicalDays));
  const futureDays = Math.max(7, envInt('SEED_FUTURE_DAYS', p.futureDays));
  const avgAppointmentsPerDay = Math.max(4, envInt('SEED_AVG_APPTS_DAY', p.avgAppointmentsPerDay));

  return {
    seed: envInt('SEED_RANDOM_SEED', 0x5eedface),
    scale,
    patientsPerPrimaryTenant,
    doctors,
    historicalDays,
    futureDays,
    avgAppointmentsPerDay,
    clinicLoadFactor: Math.min(1.8, Math.max(0.35, envFloat('SEED_LOAD_FACTOR', 1))),
    revenueMultiplier: Math.min(3, Math.max(0.5, envFloat('SEED_REVENUE_MULT', 1))),
    realisticMode: envBool('SEED_REALISTIC', true),
    extraTenantCount: Math.max(0, envInt('SEED_EXTRA_TENANTS', p.extraTenantCount)),
    extraTenantPatientRatio: Math.min(0.85, Math.max(0.08, envFloat('SEED_EXTRA_TENANT_RATIO', 0.22))),
  };
}
