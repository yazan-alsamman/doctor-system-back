import type { SeedConfig } from '../core/types';
import type { Rng } from '../core/rng';
import { CLOSED_WEEKDAYS, MONTH_REVENUE_BIAS } from '../constants/clinic-calendar';

export type ScenarioName =
  | 'baseline'
  | 'busyRamadan'
  | 'holidayRush'
  | 'campaignDiscount'
  | 'vipWeek'
  | 'doctorVacation';

export interface ScenarioContext {
  rng: Rng;
  config: SeedConfig;
  /** Index of doctor "on vacation" for doctorVacation scenario */
  vacationDoctorIndex?: number;
}

/** Combine scenarios — product of multipliers (clamped). */
export function combinedDayMultiplier(
  date: Date,
  active: ScenarioName[],
  ctx: ScenarioContext,
): number {
  let m = 1;
  for (const s of active) {
    m *= scenarioMultiplier(date, s, ctx);
  }
  return Math.min(2.4, Math.max(0.35, m));
}

function scenarioMultiplier(date: Date, name: ScenarioName, ctx: ScenarioContext): number {
  const d = date.getDate();
  const month = date.getMonth();
  switch (name) {
    case 'baseline':
      return 1;
    case 'busyRamadan': {
      // Approximate Ramadan season shift — demo uses June-ish dip then uplift evenings (encoded as lower midday factor)
      const ramadanLike = month === 5 || month === 6;
      return ramadanLike ? 0.78 + ctx.rng.next() * 0.08 : 1;
    }
    case 'holidayRush': {
      const nearEid = month === 3 && d >= 20;
      return nearEid ? 1.35 : 1;
    }
    case 'campaignDiscount':
      return month === 10 ? 1.22 : 1; // November bump
    case 'vipWeek':
      return d <= 7 ? 1.12 : 1;
    case 'doctorVacation':
      return 0.88;
    default:
      return 1;
  }
}

export function activeScenariosForTenant(seed: number, tenantSlug: string): ScenarioName[] {
  const base: ScenarioName[] = ['baseline'];
  const h = (seed + tenantSlug.length) % 7;
  if (h === 0 || h === 3) base.push('busyRamadan');
  if (h === 1) base.push('holidayRush');
  if (h === 2) base.push('campaignDiscount');
  if (h === 4) base.push('vipWeek');
  if (h === 5) base.push('doctorVacation');
  return base;
}

export function weekdayLoadFactor(day: number): number {
  if (CLOSED_WEEKDAYS.has(day)) return 0;
  const map: Record<number, number> = {
    0: 0.88,
    1: 1.06,
    2: 1.1,
    3: 1.04,
    4: 1.0,
    5: 0,
    6: 0.74,
  };
  return map[day] ?? 1;
}

export function seasonalMonthFactor(date: Date): number {
  return MONTH_REVENUE_BIAS[date.getMonth()] ?? 1;
}
