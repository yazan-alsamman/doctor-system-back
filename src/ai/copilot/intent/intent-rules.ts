import type { DetectedIntent, IntentType } from './intent.types';

/**
 * Cheap keyword pass that skips an LLM round-trip (~300-600ms saved) when
 * the user intent is unambiguous. Conservative: returns null when ambiguous
 * so the LLM classifier still runs.
 */
export function tryFastIntentClassification(input: string): DetectedIntent | null {
  const t = input.trim();
  if (t.length < 2) return null;

  const language: DetectedIntent['language'] = /[؀-ۿ]/.test(t)
    ? 'ar'
    : /[a-zA-Z]{3,}/.test(t)
      ? 'en'
      : 'mixed';

  const lower = t.toLowerCase();

  // ── Direct high-confidence patterns (skip scoring) ───────────────────────

  // Listing / counting today's or period's appointments
  if (/^(كم|اعرض|أظهر|قائمة|عدد|ما)[\s؀-ۿ]*(موعد|مواعيد)/i.test(t)) {
    return make('scheduling', 'high', language);
  }
  if (/^(how many|list|show)\s+appointments/i.test(lower)) {
    return make('scheduling', 'high', language);
  }

  // Finance — standalone unpaid/revenue patterns
  if (/^(ما|اعرض|أظهر|كم)\s+(الفواتير\s+غير\s+المدفوعة|الفواتير\s+المعلقة|إيرادات\s+اليوم|إيرادات\s+الشهر)/i.test(t)) {
    return make('finance', 'high', language);
  }

  // Patient search with explicit name or phone pattern
  if (/^(ابحث|ابحثي|بحث|دور)\s+(عن|على)?\s+(مريض|مريضة)/i.test(t)) {
    return make('search', 'high', language);
  }
  if (/^(find|search|look up)\s+(patient|a patient)/i.test(lower)) {
    return make('search', 'high', language);
  }

  // WhatsApp / message
  if (/^(أرسل|ارسل|اكتب)\s+(رسالة|واتساب|تذكير)/i.test(t)) {
    return make('communication', 'high', language);
  }

  // ── Scoring for less obvious queries ─────────────────────────────────────

  const scored: Record<Exclude<IntentType, 'clinical' | 'general'>, number> = {
    search:        0,
    scheduling:    0,
    finance:       0,
    communication: 0,
  };

  // Search signals
  if (/بحث|ابحث|ابحثي|دور على|أين أجد|أين هو|قائمة ب|عرض كل|من هو المريض|موجود في النظام/i.test(t))
    scored.search += 3;
  if (/\bsearch\b|\bfind\b|\bwho is\b/i.test(lower))
    scored.search += 2;

  // Scheduling signals — list/count + booking
  if (/كم|عدد|قائمة|اعرض|أظهر|ما مواعيد/i.test(t))
    scored.scheduling += 2;
  if (/موعد|حجز|جدولة|إضافة موعد|احجز|مواعيد اليوم|وقت فارغ|slot|calendar/i.test(t))
    scored.scheduling += 3;
  if (/\bappointment\b|\bbook\b|\bschedule\b|\bavailability\b|\blist\b|\bhow many\b/i.test(lower))
    scored.scheduling += 2;

  // Finance signals
  if (/فاتورة|فواتير|دفع|تحصيل|غير مدفوع|متأخر|إيراد|تحصيلات|مبالغ/i.test(t))
    scored.finance += 3;
  if (/\binvoice\b|\bpayment\b|\brevenue\b|\bunpaid\b|\bdue\b|\bbilling\b/i.test(lower))
    scored.finance += 2;

  // Communication signals
  if (/واتساب|رسالة|تذكير|إشعار|إرسال/i.test(t))
    scored.communication += 3;
  if (/\bwhatsapp\b|\bmessage\b|\bremind\b|\bnotify\b|\bsms\b/i.test(lower))
    scored.communication += 2;

  const ranked = (
    Object.entries(scored) as [keyof typeof scored, number][]
  ).sort((a, b) => b[1] - a[1]);

  const [bestKey, bestScore] = ranked[0]!;
  const secondScore = ranked[1]?.[1] ?? 0;

  // Require clear margin to avoid mis-classification
  if (bestScore < 2) return null;
  if (bestScore - secondScore < 1 && secondScore >= 2) return null;

  return make(bestKey as IntentType, bestScore >= 4 ? 'high' : 'medium', language);
}

function make(
  intent: IntentType,
  confidence: 'high' | 'medium' | 'low',
  language: DetectedIntent['language'],
): DetectedIntent {
  return { intent, confidence, entities: {}, language };
}
