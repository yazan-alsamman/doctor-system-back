/**
 * Timezone-aware date utilities.
 * All appointment time comparisons must go through these helpers so that
 * the server's OS timezone never leaks into scheduling logic.
 *
 * Set CLINIC_TIMEZONE in .env to an IANA timezone name, e.g. "Africa/Cairo".
 * Defaults to "UTC" when unset.
 */

export function getClinicTimezone(): string {
  return process.env.CLINIC_TIMEZONE?.trim() || 'UTC';
}

/**
 * Convert a UTC Date to hours*60+minutes in the clinic's local timezone.
 * Used to compare appointment times against schedule start/end strings.
 */
export function toLocalMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/**
 * Parse a 'YYYY-MM-DD' string as UTC midnight of that date in the given timezone.
 *
 * Strategy: at 12:00 UTC the timezone offset is stable (avoids DST ambiguity at
 * midnight). We read the local hour at noon UTC, compute the UTC↔local offset,
 * then subtract it from UTC midnight to get local midnight in UTC terms.
 */
export function startOfDayInTimezone(dateStr: string, timezone: string): Date {
  const noonUtc = new Date(`${dateStr}T12:00:00.000Z`);

  const noonParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(noonUtc);

  const localH = Number(noonParts.find((p) => p.type === 'hour')?.value ?? 12) % 24;
  const localM = Number(noonParts.find((p) => p.type === 'minute')?.value ?? 0);
  // offset = local - UTC (in minutes); UTC noon = 720 min
  const offsetMinutes = localH * 60 + localM - 720;

  // midnight local = midnight UTC shifted by offset
  const midnightUtcMs = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  return new Date(midnightUtcMs - offsetMinutes * 60_000);
}
