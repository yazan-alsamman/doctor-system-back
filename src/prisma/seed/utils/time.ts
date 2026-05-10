import { addDays, addMinutes, setHours, setMilliseconds, setMinutes, setSeconds, startOfDay } from 'date-fns';

export function stripTime(d: Date): Date {
  return startOfDay(d);
}

export function atLocalTime(day: Date, hour: number, minute: number): Date {
  let t = stripTime(day);
  t = setHours(t, hour);
  t = setMinutes(t, minute);
  t = setSeconds(t, 0);
  t = setMilliseconds(t, 0);
  return t;
}

export function parseHHMM(s: string): { h: number; m: number } {
  const [hs, ms] = s.split(':');
  return { h: Number(hs), m: Number(ms || '0') };
}

export function combineDayAndHHMM(day: Date, hhmm: string): Date {
  const { h, m } = parseHHMM(hhmm);
  return atLocalTime(day, h, m);
}

export function endFromStart(start: Date, durationMinutes: number): Date {
  return addMinutes(start, durationMinutes);
}

export function daysBetweenInclusive(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  let cur = stripTime(from);
  const end = stripTime(to);
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Minutes from midnight for a Date */
export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function overlaps(a0: Date, a1: Date, b0: Date, b1: Date): boolean {
  return a0 < b1 && b0 < a1;
}
