import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import type { ParseBookingDto } from './dto/parse-booking.dto';

const ConfLevel = z.enum(['high', 'medium', 'low']);

type ConfLevelType = z.infer<typeof ConfLevel>;

/** Strict schema (used only for logging / optional validation after coercion). */
const RawResultSchema = z.object({
  patient: z.string(),
  doctorId: z.string(),
  doctorName: z.string(),
  day: z.number().int().min(0).max(6),
  dayLabel: z.string(),
  start: z.number(),
  duration: z.number(),
  reason: z.string(),
  visitType: z.string().optional(),
  urgent: z.boolean(),
  conf: z.object({
    patient: ConfLevel,
    doctor: ConfLevel,
    day: ConfLevel,
    time: ConfLevel,
    reason: ConfLevel,
  }),
});

export type BookingParseResult = z.infer<typeof RawResultSchema>;

const EASTERN_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function westernizeDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (ch) => String(EASTERN_DIGITS.indexOf(ch)));
}

function toFiniteNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = westernizeDigits(v.trim()).replace(/,/g, '.');
    if (t === '') return undefined;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function toIntDay(v: unknown): number | undefined {
  const n = toFiniteNumber(v);
  if (n === undefined) return undefined;
  return Math.trunc(n);
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === 'yes' || s === '1' || s === 'نعم') return true;
    if (s === 'false' || s === 'no' || s === '0' || s === 'لا') return false;
  }
  if (typeof v === 'number') return v !== 0;
  return false;
}

function normalizeConfLevel(v: unknown): ConfLevelType {
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (/high|عال|قوي|strong/i.test(s)) return 'high';
    if (/low|ضعيف|منخفض|weak/i.test(s)) return 'low';
    return 'medium';
  }
  return 'medium';
}

function normalizeConfObject(raw: unknown): BookingParseResult['conf'] {
  const base: BookingParseResult['conf'] = {
    patient: 'medium',
    doctor: 'medium',
    day: 'medium',
    time: 'medium',
    reason: 'medium',
  };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const c = raw as Record<string, unknown>;
  return {
    patient: normalizeConfLevel(c.patient),
    doctor: normalizeConfLevel(c.doctor ?? c.doctorConfidence),
    day: normalizeConfLevel(c.day),
    time: normalizeConfLevel(c.time ?? c.timeConfidence),
    reason: normalizeConfLevel(c.reason),
  };
}

/**
 * Gemini often returns numbers as strings, omits conf, or wraps the payload.
 * Normalize into the shape expected by normalizeResult().
 */
function coerceGeminiBookingPayload(
  parsed: unknown,
  input: ParseBookingDto,
  refDow: number,
): BookingParseResult {
  const weekdayAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const first = input.doctors[0];

  let root: unknown = parsed;
  if (Array.isArray(root) && root[0] && typeof root[0] === 'object' && !Array.isArray(root[0])) {
    root = root[0];
  }

  let o: Record<string, unknown> =
    root && typeof root === 'object' && !Array.isArray(root) ?
      { ...(root as Record<string, unknown>) }
    : {};

  const unwrapKeys = ['booking', 'appointment', 'data', 'result', 'parsed', 'output', 'payload'];
  for (const k of unwrapKeys) {
    const inner = o[k];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      o = { ...o, ...(inner as Record<string, unknown>) };
      break;
    }
  }

  const patient =
    String(o.patient ?? o.patientName ?? o.name ?? '').trim() || 'مريض جديد';
  const doctorName =
    String(o.doctorName ?? o.doctor ?? '').trim() || first.name;
  let doctorId = String(o.doctorId ?? o.doctor_id ?? '').trim();
  if (!doctorId) doctorId = first.id;

  let day = toIntDay(o.day ?? o.dayIndex ?? o.weekday);
  if (day === undefined || !Number.isFinite(day)) day = refDow;
  day = Math.min(6, Math.max(0, day));

  const dayLabel =
    String(o.dayLabel ?? o.day_label ?? weekdayAr[day] ?? '').trim() || weekdayAr[day] || '';

  let start = toFiniteNumber(o.start ?? o.startHour ?? o.time ?? o.slotStart);
  if (start === undefined) start = 9;

  let duration = toFiniteNumber(o.duration ?? o.durationHours);
  if (duration === undefined) duration = 1;

  const reason =
    String(o.reason ?? o.visitReason ?? o.service ?? '').trim() || 'استشارة';
  const visitRaw = o.visitType ?? o.visit_type ?? o.type;
  const visitType =
    visitRaw !== undefined && visitRaw !== null ? String(visitRaw).trim() : undefined;

  return {
    patient,
    doctorId,
    doctorName,
    day,
    dayLabel,
    start,
    duration,
    reason,
    visitType: visitType || undefined,
    urgent: toBool(o.urgent ?? o.isUrgent ?? o.emergency),
    conf: normalizeConfObject(o.conf ?? o.confidence ?? o.scores),
  };
}

/** If user wrote «6 م / مساء» but model returned 6 instead of 18, fix before clamping. */
function inferPmFromUserText(start: number, userText: string): number {
  let s = Number(start);
  if (!Number.isFinite(s)) return 9;
  const text = westernizeDigits(userText);
  const compact = text.replace(/\s+/g, '');
  const evening =
    /مساءً?|مساء|العصر|عصراً|ليلاً?|\bp\.?m\.?\b/i.test(text) ||
    /[٠-٩0-9]{1,2}م(?!س)/.test(compact) ||
    /الساعة[٠-٩0-9]{1,2}م/.test(compact);
  const morning = /صباحاً?|الصباح|\ba\.?m\.?\b/i.test(text) && !/مساء/.test(text);
  if (evening && !morning && s >= 1 && s <= 11) {
    return s + 12;
  }
  return s;
}

/** Default when `GEMINI_MODEL` is unset — Gemini 3.1 Flash Lite (preview). Fallback uses an older flash-lite if the primary fails. */
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';

const FALLBACK_GEMINI_MODEL = 'gemini-2.0-flash-lite';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(err: unknown): boolean {
  const s = String(err);
  return (
    s.includes('429') ||
    s.includes('Too Many Requests') ||
    /quota|rate\s*limit/i.test(s)
  );
}

@Injectable()
export class GeminiBookingService {
  private readonly logger = new Logger(GeminiBookingService.name);

  constructor(private readonly config: ConfigService) {}

  async parseNaturalLanguageBooking(input: ParseBookingDto): Promise<BookingParseResult> {
    const apiKey =
      this.config.get<string>('GEMINI_API_KEY')?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException({
        message: 'GEMINI_API_KEY is not set',
        code: 'GEMINI_NOT_CONFIGURED',
      });
    }

    const configuredModel =
      this.config.get<string>('GEMINI_MODEL')?.trim() ||
      process.env.GEMINI_MODEL?.trim() ||
      DEFAULT_GEMINI_MODEL;

    /** Try configured/default model first, then a stable fallback if quota/model fails. */
    const modelChain = [configuredModel, FALLBACK_GEMINI_MODEL].filter(
      (m, i, arr) => m.length > 0 && arr.indexOf(m) === i,
    );

    const genAI = new GoogleGenerativeAI(apiKey);

    const ref =
      input.referenceDateIso?.trim() ?
        (() => {
          const d = new Date(input.referenceDateIso);
          return Number.isNaN(d.getTime()) ? new Date() : d;
        })()
      : new Date();
    const refDow = ref.getDay();
    const weekdayAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    const doctorLines = input.doctors
      .map((d) => `- id: ${JSON.stringify(d.id)} | name: ${d.name}${d.dept ? ` | dept: ${d.dept}` : ''}`)
      .join('\n');

    const patientLines =
      input.patients?.length ?
        input.patients.map((p) => `- ${p.name}`).join('\n')
      : '(none — infer name from text or use "مريض جديد")';

    const prompt = `You extract structured appointment booking fields from Arabic or mixed Arabic/English clinic text.
Return ONLY valid JSON (no markdown).

REFERENCE "NOW" (client local instant): ISO ${ref.toISOString()}
REFERENCE weekday index (same as JavaScript Date#getDay()): ${refDow} = ${weekdayAr[refDow]}

DAY INDEX (must be integer 0–6, same as JS getDay):
0 Sunday الأحد, 1 Monday الإثنين, 2 Tuesday الثلاثاء, 3 Wednesday الأربعاء, 4 Thursday الخميس, 5 Friday الجمعة, 6 Saturday السبت.

Relative dates (use REFERENCE "NOW" weekday):
- اليوم / اليوم نفسه → day = ${refDow}
- غداً / بكرا / بكرة → day = (${refDow} + 1) % 7
- بعد غد / بعد بكرا → day = (${refDow} + 2) % 7
- نهاية الأسبوع / يوم الجمعة → prefer Friday (5) if mentioned; السبت → 6
- If a weekday is named explicitly (e.g. الإثنين), set day to that index even if it is in the past relative to REFERENCE; the UI will adjust.
- العطلة / يوم الراحة often Friday or Saturday in some regions — map from wording.

TIME as decimal hours 24h (allow quarter hours: 9.25 = 09:15, 14.5 = 14:30):
- Parse Eastern Arabic digits (٠١٢٣٤٥٦٧٨٩) and Western digits.
- 4 مساءً / الساعة 4 العصر / الرابعة عصراً → 16
- 9 ونص صباحاً → 9.5
- ربع ساعة after an hour phrase → add 0.25; نص ساعة → add 0.5
- ظهراً / بعد الظهر → around 12–14 if no hour given
- صباحاً without hour → default 9; مساءً without hour → default 17
- Allow full day range roughly 06:00–22:00 for extraction (clinic may reject outside doctor schedule later).

DURATION (hours): pick nearest of 0.5, 1, 1.5, 2 (default 1). ربع ساعة/نص ساعة in text may imply 0.5.

URGENT: true if عاجل / طارئ / ASAP / حالة طارئة.

DOCTOR: doctorId MUST be exactly one id from the list below. Match by Arabic/Latin name, nickname, or dept; fuzzy match allowed; if unclear pick the most likely doctor and set conf.doctor to medium/low.

PATIENT: match known patients when plausible; else new name from text or "مريض جديد".

REASON / visitType: concise Arabic (e.g. فحص عام، استشارة، متابعة، بوتوكس تجميلي، تنظيف أسنان، جلسة علاج طبيعي، ألم، متابعة ما بعد العملية). visitType can mirror reason or a clinic category.

CONFIDENCE conf object REQUIRED with keys patient, doctor, day, time, reason — each value exactly one of: "high", "medium", "low" (English strings).

MANDATORY top-level JSON keys (use these exact names): patient, doctorId, doctorName, day, dayLabel, start, duration, reason, visitType, urgent, conf
- day: integer 0-6 (not a string)
- start, duration: JSON numbers (not strings), quarter hours allowed e.g. 18.25
- urgent: boolean true or false (not "true" string)
- visitType: string (use "" if unknown)

CRITICAL for Arabic PM: الساعة 6 مساءً / 6 م / 6م / ستة المساء means start 18.0 NOT 6.0. Only use 6.0 for morning if the text says صباحاً / ص / الصباح.

Doctors:
${doctorLines}

Known patients:
${patientLines}

User text:
${JSON.stringify(input.text)}`;

    let rawText = '';
    let lastErr: unknown;
    let usedModel = '';

    outer: for (const mid of modelChain) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const model = genAI.getGenerativeModel({
            model: mid,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });
          const result = await model.generateContent(prompt);
          rawText = result.response.text();
          usedModel = mid;
          break outer;
        } catch (err) {
          lastErr = err;
          const retry = isRetryableGeminiError(err) && attempt < 2;
          this.logger.warn(
            `Gemini generateContent failed (model=${mid}, attempt=${attempt + 1}): ${String(err)}`,
          );
          if (retry) {
            const delayMs = 1300 * (attempt + 1);
            await sleep(delayMs);
            continue;
          }
          break;
        }
      }
    }

    if (usedModel === '') {
      const quotaHint =
        lastErr != null && isRetryableGeminiError(lastErr) ?
          'تجاوز الحصة أو الطلبات (429). جرّب GEMINI_MODEL=gemini-1.5-flash أو غيّر النموذج في Google AI.'
        : '';
      this.logger.warn(`Gemini failed after fallbacks: ${String(lastErr)}`);
      throw new BadGatewayException({
        message: quotaHint || 'Gemini request failed',
        code: 'GEMINI_UPSTREAM_ERROR',
      });
    }

    let parsedJson: unknown;
    try {
      parsedJson = this.parseJsonLoose(rawText);
    } catch (err) {
      this.logger.warn(`Gemini JSON parse failed: ${String(err)} | snippet: ${rawText.slice(0, 240)}`);
      throw new BadGatewayException({
        message: 'Invalid JSON from Gemini',
        code: 'GEMINI_PARSE_ERROR',
      });
    }

    const coerced = coerceGeminiBookingPayload(parsedJson, input, refDow);
    coerced.start = inferPmFromUserText(coerced.start, input.text);

    const strictCheck = RawResultSchema.safeParse(coerced);
    if (!strictCheck.success) {
      this.logger.debug(
        `Gemini booking coerced (non-strict): ${strictCheck.error.message} | snippet: ${rawText.slice(0, 200)}`,
      );
    }

    return this.normalizeResult(coerced, input);
  }

  private parseJsonLoose(text: string): unknown {
    const trimmed = text.trim();
    const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
    const body = fence ? fence[1].trim() : trimmed;
    return JSON.parse(body) as unknown;
  }

  private normalizeResult(
    data: BookingParseResult,
    input: ParseBookingDto,
  ): BookingParseResult {
    const norm = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .replace(/^د\.?\s*/u, '')
        .replace(/\s+/g, ' ');
    const ids = new Set(input.doctors.map((d) => d.id));
    let doctorId = data.doctorId;
    if (!ids.has(doctorId)) {
      const want = norm(data.doctorName);
      const byName = input.doctors.find((d) => {
        const dn = norm(d.name);
        return (
          dn === want ||
          want.includes(dn) ||
          dn.includes(want) ||
          (want.length >= 2 && dn.includes(want.slice(0, Math.min(8, want.length))))
        );
      });
      doctorId = byName?.id ?? input.doctors[0].id;
    }
    const doctor = input.doctors.find((d) => d.id === doctorId) ?? input.doctors[0];

    const weekdayAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    let day = Math.round(data.day);
    if (!Number.isFinite(day)) day = 0;
    day = Math.min(6, Math.max(0, day));
    let dayLabel = data.dayLabel.trim() || weekdayAr[day] || '';

    let start = Number(data.start);
    if (!Number.isFinite(start)) start = 9;
    start = Math.min(21.75, Math.max(6, start));
    start = Math.round(start * 4) / 4;

    let duration = Number(data.duration);
    if (!Number.isFinite(duration)) duration = 1;
    const allowed = [0.5, 1, 1.5, 2];
    duration = allowed.reduce((prev, curr) =>
      Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev,
    );

    return {
      ...data,
      doctorId: doctor.id,
      doctorName: doctor.name,
      day,
      dayLabel,
      start,
      duration,
      reason: data.reason?.trim() || 'استشارة',
      visitType: data.visitType?.trim(),
      urgent: Boolean(data.urgent),
    };
  }
}
