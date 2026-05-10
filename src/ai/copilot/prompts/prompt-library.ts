import { schedulingPrompts } from './scheduling.prompts';
import { clinicalPrompts } from './clinical.prompts';
import { communicationPrompts } from './communication.prompts';
import { searchPrompts } from './search.prompts';
import { financePrompts } from './finance.prompts';
import type { PromptEntry } from './scheduling.prompts';
import type { IntentType } from '../intent/intent.types';

export type { PromptEntry };

export interface RenderedPrompt {
  systemPrompt: string;
  userMessage: string;
}

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}

export class PromptLibrary {
  static readonly scheduling = schedulingPrompts;
  static readonly clinical = clinicalPrompts;
  static readonly communication = communicationPrompts;
  static readonly search = searchPrompts;
  static readonly finance = financePrompts;

  static render(prompt: PromptEntry, vars: Record<string, string>): RenderedPrompt {
    return {
      systemPrompt: render(prompt.system, vars),
      userMessage: render(prompt.user, vars),
    };
  }

  static selectSchedulingPrompt(input: string): PromptEntry {
    const s = input.trim();

    // Listing / counting queries — must be checked first
    // e.g. "كم موعد اليوم؟", "اعرض مواعيد الأسبوع", "ما مواعيد اليوم"
    if (/كم|عدد|قائمة|اعرض|أظهر|ما مواعيد|list|show|how many|count/i.test(s)) {
      return schedulingPrompts.appointmentLister;
    }

    if (/تعارض|ازدواج|مزدحم|تضارب|overbook|conflict|collision/i.test(s)) {
      return schedulingPrompts.conflictResolver;
    }
    if (/تحسين|توازن|أوقات|فعالية|optimize|efficiency|balance/i.test(s)) {
      return schedulingPrompts.appointmentOptimizer;
    }
    return schedulingPrompts.smartAdvisor;
  }

  /** Returns true when the scheduling query is asking to list/count existing appointments. */
  static isListingSchedulingQuery(input: string): boolean {
    return /كم|عدد|قائمة|اعرض|أظهر|ما مواعيد|list|show|how many|count/i.test(input.trim());
  }

  static getDefaultForIntent(intent: IntentType): PromptEntry | null {
    switch (intent) {
      case 'scheduling':
        return schedulingPrompts.smartAdvisor;
      case 'clinical':
        return clinicalPrompts.patientBriefingSummarizer;
      case 'communication':
        return communicationPrompts.whatsappMessageGenerator;
      case 'search':
        return searchPrompts.naturalLanguageQueryConverter;
      case 'finance':
        return financePrompts.revenueExplainer;
      default:
        return null;
    }
  }

  static getIntentClassifierPrompt(): string {
    return `You are an intent classifier for MediFlow, a medical clinic management SaaS platform.

Classify the user's input into EXACTLY ONE of these intents:

- "scheduling"     → booking, slots, schedule, availability, calendar, موعد, جدول, حجز, وقت فاضي
- "clinical"       → patient history, medical notes, allergies, briefing, ملف مريض, تاريخ مريض, تنبيه
- "communication"  → WhatsApp, SMS, reminder, follow-up, رسالة, واتساب, تذكير, متابعة
- "finance"        → invoices, payments, revenue, billing, فاتورة, إيرادات, مدفوع, دفع, مبالغ
- "search"         → searching/finding patients, records, appointments, بحث, فين, مين, اللي
- "general"        → greetings, help, unclassifiable, or anything not matching above

The input may be Arabic, English, or a mix.

Output ONLY valid JSON (no extra text):
{
  "intent": "scheduling|clinical|communication|finance|search|general",
  "confidence": "high|medium|low",
  "entities": {
    "patientName": "extracted patient name or null",
    "doctorName": "extracted doctor name or null",
    "date": "extracted date string or null",
    "timeRange": "extracted time range or null",
    "invoiceStatus": "draft|paid|partial|unpaid|null — unpaid = outstanding / not fully collected",
    "searchQuery": "core search keywords or null"
  },
  "language": "ar|en|mixed"
}`;
  }

  static getGeneralAssistantPrompt(): RenderedPrompt {
    return {
      systemPrompt: `You are MediFlow Copilot, an AI assistant for a medical clinic management platform.
You help clinic staff with scheduling, patient management, billing, and communication tasks.

RULES:
- NEVER give medical diagnosis or clinical advice
- NEVER directly modify system data — only suggest
- Be helpful, concise, and professional
- Respond in the user's language (Arabic preferred for Arabic input)
- When listing steps or options, use clear bullet-style lines (each point on its own line with • or -)
- End with what the user can do next in MediFlow (screens, menus) when relevant
- If you cannot help, clearly state what the system can do instead`,
      userMessage: `{{input}}`,
    };
  }
}
