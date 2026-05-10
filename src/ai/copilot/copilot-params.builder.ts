import { addDays, format, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { CopilotRequestDto } from './dto/copilot-request.dto';
import type { DetectedIntent } from './intent/intent.types';

/**
 * IANA zone for resolving "اليوم" / week / month to UTC instants that match the clinic wall calendar.
 * Example: `Asia/Riyadh`, `Asia/Damascus`. Defaults to **Asia/Riyadh**; set `CLINIC_TIMEZONE=UTC` if needed.
 */
function clinicTimeZone(): string {
  /** Default aligns Arabic-region clinics; set `CLINIC_TIMEZONE=UTC` for pure UTC. */
  return process.env.CLINIC_TIMEZONE?.trim() || 'Asia/Riyadh';
}

/** Clinic-local calendar date (YYYY-MM-DD) — use in prompts + date semantics. */
export function clinicCalendarToday(d = new Date()): string {
  return calendarDateInZone(d, clinicTimeZone());
}

/** YYYY-MM-DD for `date` interpreted in `timeZone`. */
function calendarDateInZone(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
}

/** Inclusive UTC ISO bounds for that calendar date in the clinic zone. */
function utcBoundsForCalendarDay(
  ymd: string,
  timeZone: string,
): { from: string; to: string } {
  const start = fromZonedTime(`${ymd}T00:00:00`, timeZone);
  const end = fromZonedTime(`${ymd}T23:59:59.999`, timeZone);
  return { from: start.toISOString(), to: end.toISOString() };
}

/**
 * Deterministic tool parameter resolution (date ranges, listing flags, merged context).
 * Shared by {@link CopilotService} and search fallbacks.
 */
export function resolveToolParams(
  dto: CopilotRequestDto,
  intent: DetectedIntent,
): Record<string, unknown> {
  const input = dto.input;
  const tz = clinicTimeZone();

  const isListingQuery =
    /كم|عدد|قائمة|اعرض|أظهر|ما مواعيد|list|show|how many|count/i.test(input);

  let from: string | undefined = dto.context?.dateRange?.from;
  let to: string | undefined = dto.context?.dateRange?.to;

  if (!from && !to) {
    const todayYmd = calendarDateInZone(new Date(), tz);

    if (/اليوم|today/i.test(input)) {
      const b = utcBoundsForCalendarDay(todayYmd, tz);
      from = b.from;
      to = b.to;
    } else if (/غداً|غدا|غدًا|بكره|بكرا|tomorrow/i.test(input)) {
      const ymd = format(addDays(parseISO(todayYmd), 1), 'yyyy-MM-dd');
      const b = utcBoundsForCalendarDay(ymd, tz);
      from = b.from;
      to = b.to;
    } else if (/أمس|البارحة|امس|yesterday/i.test(input)) {
      const ymd = format(addDays(parseISO(todayYmd), -1), 'yyyy-MM-dd');
      const b = utcBoundsForCalendarDay(ymd, tz);
      from = b.from;
      to = b.to;
    } else if (/هذا الأسبوع|this week|الأسبوع الحالي/i.test(input)) {
      const startYmd = todayYmd;
      const endYmd = format(addDays(parseISO(startYmd), 6), 'yyyy-MM-dd');
      from = utcBoundsForCalendarDay(startYmd, tz).from;
      to = utcBoundsForCalendarDay(endYmd, tz).to;
    } else if (/هذا الشهر|this month|الشهر الحالي/i.test(input)) {
      const [yStr, mStr] = todayYmd.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      const firstYmd = `${yStr}-${mStr}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const lastYmd = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
      from = utcBoundsForCalendarDay(firstYmd, tz).from;
      to = utcBoundsForCalendarDay(lastYmd, tz).to;
    } else if (
      intent.intent === 'scheduling' &&
      isListingQuery &&
      /موعد|مواعيد|appointment/i.test(input)
    ) {
      // Listing without an explicit day → current clinic calendar day (avoids “random” first rows).
      const b = utcBoundsForCalendarDay(todayYmd, tz);
      from = b.from;
      to = b.to;
    } else {
      // Intent classifier emits `entities.date` (often YYYY-MM-DD). Use it for availability / search
      // when the user names a calendar day but the phrase did not match keywords above.
      const entYmd = intent.entities.date?.trim();
      if (
        (intent.intent === 'scheduling' || intent.intent === 'search') &&
        entYmd &&
        /^\d{4}-\d{2}-\d{2}$/.test(entYmd)
      ) {
        const b = utcBoundsForCalendarDay(entYmd, tz);
        from = b.from;
        to = b.to;
      }
    }
  }

  return {
    patientId: dto.context?.patientId ?? intent.entities.patientId,
    doctorId: dto.context?.doctorId ?? intent.entities.doctorId,
    from,
    to,
    patientName: intent.entities.patientName,
    doctorName: intent.entities.doctorName,
    searchQuery: intent.entities.searchQuery ?? dto.input,
    invoiceStatus: intent.entities.invoiceStatus,
    status: intent.entities.invoiceStatus,
    isListingQuery,
  };
}
