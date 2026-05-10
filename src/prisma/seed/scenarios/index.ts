/**
 * Scenario hooks — returned multipliers compose with baseline scheduling.
 * Use via `combinedDayMultiplier(date, ['baseline', 'busyRamadan'], ctx)` or extend engine.
 */
import type { ScenarioContext } from './scenarios';
import { combinedDayMultiplier } from './scenarios';

export function busyRamadanScenario(date: Date, ctx: ScenarioContext): number {
  return combinedDayMultiplier(date, ['baseline', 'busyRamadan'], ctx);
}

export function holidayRushScenario(date: Date, ctx: ScenarioContext): number {
  return combinedDayMultiplier(date, ['baseline', 'holidayRush'], ctx);
}

export function campaignDiscountScenario(date: Date, ctx: ScenarioContext): number {
  return combinedDayMultiplier(date, ['baseline', 'campaignDiscount'], ctx);
}

export function vipWeekScenario(date: Date, ctx: ScenarioContext): number {
  return combinedDayMultiplier(date, ['baseline', 'vipWeek'], ctx);
}

export function doctorVacationScenario(date: Date, ctx: ScenarioContext): number {
  return combinedDayMultiplier(date, ['baseline', 'doctorVacation'], ctx);
}
