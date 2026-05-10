import type { ToolName } from './tools/tool.types';

/**
 * When the model returns JSON (or fenced JSON) but strict parsing fails, still surface
 * `answer` / `summary` / `message` so users never see raw JSON blobs.
 */
export function extractPrimaryAssistantText(raw: string): string {
  const t = raw.trim();
  if (!t) return '—';
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  const body = (fence ? fence[1] : t).trim();
  if (body.startsWith('{')) {
    try {
      const o = JSON.parse(body) as Record<string, unknown>;
      const pick =
        (typeof o.answer === 'string' && o.answer.trim()) ||
        (typeof o.summary === 'string' && o.summary.trim()) ||
        (typeof o.message === 'string' && o.message.trim()) ||
        (typeof o.text === 'string' && o.text.trim());
      if (pick) return pick;
      if (typeof o.explanation === 'string' && o.explanation.trim()) {
        return o.explanation.trim();
      }
    } catch {
      /* keep raw */
    }
  }
  return t;
}

/** Prefer concise copy shown first; falls back through common LLM JSON shapes across intents. */
function primaryNarrative(parsed: Record<string, unknown>): string {
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = parsed[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };

  let main = pick(
    'answer',
    'explanation',
    'summary',
    'overall_summary',
    'message',
    'whatsapp_message',
    'sms_message',
    'period_summary',
    'display_query',
    'visit_frequency_summary',
    'documented_notes',
  );

  if (!main && typeof parsed.total_revenue !== 'undefined') {
    const period = String(parsed.period ?? 'الفترة');
    const tr = parsed.total_revenue;
    const col = parsed.collected_amount;
    const out = parsed.outstanding_amount;
    const rate = parsed.collection_rate_percent;
    const parts = [
      `خلال ${period}`,
      typeof tr !== 'undefined' ? `إجمالي الإيرادات: ${tr}` : '',
      typeof col !== 'undefined' ? `المحصّل: ${col}` : '',
      typeof out !== 'undefined' ? `المتبقي: ${out}` : '',
      typeof rate !== 'undefined' ? `نسبة التحصيل: ${rate}%` : '',
    ].filter(Boolean);
    main = parts.join(' — ');
  }

  return main;
}

function isArabicPreferred(lang?: string): boolean {
  return lang !== 'en';
}

function schedulingExtras(parsed: Record<string, unknown>, lang?: string): string[] {
  const lines: string[] = [];
  const ar = isArabicPreferred(lang);

  const rec = parsed.recommended_slot;
  if (rec && typeof rec === 'object') {
    const r = rec as Record<string, unknown>;
    const bit = [
      r.date,
      r.time,
      r.doctorName,
      r.rationale ? `(${r.rationale})` : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (bit.trim()) {
      lines.push(ar ? `• مقترح أولي: ${bit}` : `• Suggested slot: ${bit}`);
    }
  }

  const alt = parsed.alternative_slot;
  if (alt && typeof alt === 'object') {
    const r = alt as Record<string, unknown>;
    const bit = [r.date, r.time, r.doctorName, r.rationale].filter(Boolean).join(' ');
    if (bit.trim()) lines.push(ar ? `• بديل: ${bit}` : `• Alternative: ${bit}`);
  }

  return lines;
}

function collectActionBullets(parsed: Record<string, unknown>): string[] {
  const out: string[] = [];
  const pushStrings = (key: string) => {
    const v = parsed[key];
    if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === 'string' && x.trim()) out.push(x.trim());
      }
    }
  };

  pushStrings('next_steps');
  pushStrings('suggested_actions');
  pushStrings('recommended_actions');
  pushStrings('suggestions');
  pushStrings('issues');
  pushStrings('risk_flags');
  pushStrings('key_insights');
  pushStrings('insights');
  pushStrings('opportunities');
  pushStrings('administrative_flags');

  const cta = parsed.cta_text;
  if (typeof cta === 'string' && cta.trim() && parsed.has_cta === true) {
    out.push(cta.trim());
  }

  const flags = parsed.flags;
  if (Array.isArray(flags)) {
    for (const f of flags) {
      if (f && typeof f === 'object' && 'suggested_action' in f) {
        const sa = (f as { suggested_action?: string }).suggested_action;
        if (sa?.trim()) out.push(sa.trim());
      }
    }
  }

  const top = parsed.top_outstanding;
  if (Array.isArray(top)) {
    for (const row of top.slice(0, 3)) {
      if (row && typeof row === 'object') {
        const r = row as Record<string, unknown>;
        const pn = r.patient_name ?? r.name;
        const amt = r.amount_due ?? r.balance;
        if (pn || amt !== undefined) {
          out.push(`${pn ?? '—'} — مستحق: ${amt ?? '—'}`);
        }
      }
    }
  }

  return [...new Set(out)].slice(0, 10);
}

function disclaimerLine(parsed: Record<string, unknown>): string | null {
  const d = parsed.disclaimer;
  return typeof d === 'string' && d.trim() ? d.trim() : null;
}

export interface ComposeOptions {
  /** `DetectedIntent.language` — headings for bullets */
  language?: string;
}

/**
 * Turn loosely-shaped LLM JSON into one cohesive assistant reply with actionable bullets.
 */
export function composeCopilotAnswer(
  parsed: Record<string, unknown> | null,
  rawText: string,
  options?: ComposeOptions,
): { response: string; copilot_hints: Record<string, unknown> } {
  if (!parsed) {
    return { response: rawText.trim() || '—', copilot_hints: {} };
  }

  const lang = options?.language;
  const ar = isArabicPreferred(lang);
  let body = primaryNarrative(parsed);
  if (!body) body = rawText.trim() || '—';

  const extraLines: string[] = [...schedulingExtras(parsed, lang)];

  const bullets = collectActionBullets(parsed);
  if (bullets.length) {
    extraLines.push(
      ar ? '• ' + bullets.join('\n• ') : '• ' + bullets.join('\n• '),
    );
  }

  let text = body;
  if (extraLines.length) {
    const heading = ar ? '\n\nما يمكن فعله بعد ذلك:' : '\n\nNext steps:';
    text += heading + '\n' + extraLines.join('\n');
  }

  const disc = disclaimerLine(parsed);
  if (disc) text += '\n\n' + disc;

  const hints: Record<string, unknown> = {
    headline: body.slice(0, 200),
    bullet_count: bullets.length,
  };
  if (bullets.length) hints.next_steps = bullets;

  return { response: text.trim(), copilot_hints: hints };
}

/** Rich search narrative from live tool rows (no extra LLM call). */
export function buildSearchNarrative(
  tool: ToolName | null | undefined,
  data: unknown,
  error: string | undefined,
  displayQuery: string,
  language?: string,
): string {
  const ar = isArabicPreferred(language);

  if (error) {
    return ar
      ? `تعذر تنفيذ البحث «${displayQuery}»: ${error}`
      : `Search failed for "${displayQuery}": ${error}`;
  }

  const rows = Array.isArray(data) ? data : data != null ? [data] : [];
  if (rows.length === 0) {
    return ar
      ? `لا توجد نتائج مطابقة لـ «${displayQuery}». جرّب اسماً مختلفاً، جزءاً من رقم الهاتف، أو وسّع نطاق التاريخ.`
      : `No matches for "${displayQuery}". Try a different name, phone fragment, or wider date range.`;
  }

  const head = ar
    ? `وُجد ${rows.length} نتيجة لـ «${displayQuery}».`
    : `Found ${rows.length} result(s) for "${displayQuery}".`;

  const lines: string[] = [];
  const limit = 6;

  const fmtTime = (iso: unknown) => {
    if (!iso) return '—';
    try {
      const d = new Date(String(iso));
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleString(ar ? 'ar-EG' : 'en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  if (tool === 'searchPatients') {
    lines.push(ar ? 'أبرز المرضى:' : 'Top matches:');
    rows.slice(0, limit).forEach((r, i) => {
      const p = r as Record<string, unknown>;
      lines.push(`${i + 1}. ${String(p.name ?? '—')} — ${String(p.phone ?? '—')}`);
    });
  } else if (tool === 'searchAppointments') {
    lines.push(ar ? 'المواعيد المطابقة:' : 'Matching appointments:');
    rows.slice(0, limit).forEach((r, i) => {
      const a = r as Record<string, unknown>;
      const patient = (a.patient as Record<string, unknown>)?.name ?? '—';
      const doctor = (a.doctor as Record<string, unknown>)?.name ?? '—';
      const svc = (a.service as Record<string, unknown>)?.name ?? '';
      lines.push(
        `${i + 1}. ${fmtTime(a.startTime)} — ${patient} / ${doctor}${svc ? ` (${svc})` : ''}`,
      );
    });
  } else if (tool === 'searchInvoices') {
    lines.push(ar ? 'الفواتير:' : 'Invoices:');
    rows.slice(0, limit).forEach((r, i) => {
      const inv = r as Record<string, unknown>;
      const patient = (inv.patient as Record<string, unknown>)?.name ?? '—';
      const bal = inv.balance ?? inv.finalAmount ?? '—';
      const st = inv.status ?? '';
      lines.push(`${i + 1}. ${patient} — ${ar ? 'متبقي' : 'due'}: ${bal} (${st})`);
    });
  } else {
    lines.push(ar ? 'معاينة:' : 'Preview:');
    rows.slice(0, 3).forEach((r, i) => {
      lines.push(`${i + 1}. ${JSON.stringify(r).slice(0, 140)}…`);
    });
  }

  if (rows.length > limit) {
    lines.push(
      ar
        ? `… و${rows.length - limit} إضافية (استخدم قائمة النظام للتصفية الكاملة).`
        : `… and ${rows.length - limit} more (use the full list view for details).`,
    );
  }

  return [head, '', ...lines].join('\n');
}
