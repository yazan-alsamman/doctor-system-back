"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPrimaryAssistantText = extractPrimaryAssistantText;
exports.composeCopilotAnswer = composeCopilotAnswer;
exports.buildSearchNarrative = buildSearchNarrative;
function extractPrimaryAssistantText(raw) {
    const t = raw.trim();
    if (!t)
        return '—';
    const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
    const body = (fence ? fence[1] : t).trim();
    if (body.startsWith('{')) {
        try {
            const o = JSON.parse(body);
            const pick = (typeof o.answer === 'string' && o.answer.trim()) ||
                (typeof o.summary === 'string' && o.summary.trim()) ||
                (typeof o.message === 'string' && o.message.trim()) ||
                (typeof o.text === 'string' && o.text.trim());
            if (pick)
                return pick;
            if (typeof o.explanation === 'string' && o.explanation.trim()) {
                return o.explanation.trim();
            }
        }
        catch {
        }
    }
    return t;
}
function primaryNarrative(parsed) {
    const pick = (...keys) => {
        for (const k of keys) {
            const v = parsed[k];
            if (typeof v === 'string' && v.trim())
                return v.trim();
        }
        return '';
    };
    let main = pick('answer', 'explanation', 'summary', 'overall_summary', 'message', 'whatsapp_message', 'sms_message', 'period_summary', 'display_query', 'visit_frequency_summary', 'documented_notes');
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
function isArabicPreferred(lang) {
    return lang !== 'en';
}
function schedulingExtras(parsed, lang) {
    const lines = [];
    const ar = isArabicPreferred(lang);
    const rec = parsed.recommended_slot;
    if (rec && typeof rec === 'object') {
        const r = rec;
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
        const r = alt;
        const bit = [r.date, r.time, r.doctorName, r.rationale].filter(Boolean).join(' ');
        if (bit.trim())
            lines.push(ar ? `• بديل: ${bit}` : `• Alternative: ${bit}`);
    }
    return lines;
}
function collectActionBullets(parsed) {
    const out = [];
    const pushStrings = (key) => {
        const v = parsed[key];
        if (Array.isArray(v)) {
            for (const x of v) {
                if (typeof x === 'string' && x.trim())
                    out.push(x.trim());
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
                const sa = f.suggested_action;
                if (sa?.trim())
                    out.push(sa.trim());
            }
        }
    }
    const top = parsed.top_outstanding;
    if (Array.isArray(top)) {
        for (const row of top.slice(0, 3)) {
            if (row && typeof row === 'object') {
                const r = row;
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
function disclaimerLine(parsed) {
    const d = parsed.disclaimer;
    return typeof d === 'string' && d.trim() ? d.trim() : null;
}
function composeCopilotAnswer(parsed, rawText, options) {
    if (!parsed) {
        return { response: rawText.trim() || '—', copilot_hints: {} };
    }
    const lang = options?.language;
    const ar = isArabicPreferred(lang);
    let body = primaryNarrative(parsed);
    if (!body)
        body = rawText.trim() || '—';
    const extraLines = [...schedulingExtras(parsed, lang)];
    const bullets = collectActionBullets(parsed);
    if (bullets.length) {
        extraLines.push(ar ? '• ' + bullets.join('\n• ') : '• ' + bullets.join('\n• '));
    }
    let text = body;
    if (extraLines.length) {
        const heading = ar ? '\n\nما يمكن فعله بعد ذلك:' : '\n\nNext steps:';
        text += heading + '\n' + extraLines.join('\n');
    }
    const disc = disclaimerLine(parsed);
    if (disc)
        text += '\n\n' + disc;
    const hints = {
        headline: body.slice(0, 200),
        bullet_count: bullets.length,
    };
    if (bullets.length)
        hints.next_steps = bullets;
    return { response: text.trim(), copilot_hints: hints };
}
function buildSearchNarrative(tool, data, error, displayQuery, language) {
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
    const lines = [];
    const limit = 6;
    const fmtTime = (iso) => {
        if (!iso)
            return '—';
        try {
            const d = new Date(String(iso));
            if (Number.isNaN(d.getTime()))
                return '—';
            return d.toLocaleString(ar ? 'ar-EG' : 'en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
            });
        }
        catch {
            return '—';
        }
    };
    if (tool === 'searchPatients') {
        lines.push(ar ? 'أبرز المرضى:' : 'Top matches:');
        rows.slice(0, limit).forEach((r, i) => {
            const p = r;
            lines.push(`${i + 1}. ${String(p.name ?? '—')} — ${String(p.phone ?? '—')}`);
        });
    }
    else if (tool === 'searchAppointments') {
        lines.push(ar ? 'المواعيد المطابقة:' : 'Matching appointments:');
        rows.slice(0, limit).forEach((r, i) => {
            const a = r;
            const patient = a.patient?.name ?? '—';
            const doctor = a.doctor?.name ?? '—';
            const svc = a.service?.name ?? '';
            lines.push(`${i + 1}. ${fmtTime(a.startTime)} — ${patient} / ${doctor}${svc ? ` (${svc})` : ''}`);
        });
    }
    else if (tool === 'searchInvoices') {
        lines.push(ar ? 'الفواتير:' : 'Invoices:');
        rows.slice(0, limit).forEach((r, i) => {
            const inv = r;
            const patient = inv.patient?.name ?? '—';
            const bal = inv.balance ?? inv.finalAmount ?? '—';
            const st = inv.status ?? '';
            lines.push(`${i + 1}. ${patient} — ${ar ? 'متبقي' : 'due'}: ${bal} (${st})`);
        });
    }
    else {
        lines.push(ar ? 'معاينة:' : 'Preview:');
        rows.slice(0, 3).forEach((r, i) => {
            lines.push(`${i + 1}. ${JSON.stringify(r).slice(0, 140)}…`);
        });
    }
    if (rows.length > limit) {
        lines.push(ar
            ? `… و${rows.length - limit} إضافية (استخدم قائمة النظام للتصفية الكاملة).`
            : `… and ${rows.length - limit} more (use the full list view for details).`);
    }
    return [head, '', ...lines].join('\n');
}
//# sourceMappingURL=copilot-response-composer.js.map