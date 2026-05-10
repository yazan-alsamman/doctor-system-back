/** Syrian / Levant mobile patterns — synthetic but plausible */
export const MOBILE_PREFIXES = ['094', '095', '096', '098', '099'];

/** Common clinic closure — configurable in scheduling (Friday off). */
export const CLOSED_WEEKDAYS = new Set<number>([5]); // Friday

/** Seasonal revenue uplift multipliers by month index 0–11 */
export const MONTH_REVENUE_BIAS: readonly number[] = [
  0.92, 0.94, 1.0, 1.03, 1.05, 1.08, 1.02, 1.0, 0.98, 1.06, 1.12, 1.14,
];
