"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptLibrary = void 0;
const scheduling_prompts_1 = require("./scheduling.prompts");
const clinical_prompts_1 = require("./clinical.prompts");
const communication_prompts_1 = require("./communication.prompts");
const search_prompts_1 = require("./search.prompts");
const finance_prompts_1 = require("./finance.prompts");
function render(template, vars) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}
class PromptLibrary {
    static scheduling = scheduling_prompts_1.schedulingPrompts;
    static clinical = clinical_prompts_1.clinicalPrompts;
    static communication = communication_prompts_1.communicationPrompts;
    static search = search_prompts_1.searchPrompts;
    static finance = finance_prompts_1.financePrompts;
    static render(prompt, vars) {
        return {
            systemPrompt: render(prompt.system, vars),
            userMessage: render(prompt.user, vars),
        };
    }
    static selectSchedulingPrompt(input) {
        const s = input.trim();
        if (/كم|عدد|قائمة|اعرض|أظهر|ما مواعيد|list|show|how many|count/i.test(s)) {
            return scheduling_prompts_1.schedulingPrompts.appointmentLister;
        }
        if (/تعارض|ازدواج|مزدحم|تضارب|overbook|conflict|collision/i.test(s)) {
            return scheduling_prompts_1.schedulingPrompts.conflictResolver;
        }
        if (/تحسين|توازن|أوقات|فعالية|optimize|efficiency|balance/i.test(s)) {
            return scheduling_prompts_1.schedulingPrompts.appointmentOptimizer;
        }
        return scheduling_prompts_1.schedulingPrompts.smartAdvisor;
    }
    static isListingSchedulingQuery(input) {
        return /كم|عدد|قائمة|اعرض|أظهر|ما مواعيد|list|show|how many|count/i.test(input.trim());
    }
    static getDefaultForIntent(intent) {
        switch (intent) {
            case 'scheduling':
                return scheduling_prompts_1.schedulingPrompts.smartAdvisor;
            case 'clinical':
                return clinical_prompts_1.clinicalPrompts.patientBriefingSummarizer;
            case 'communication':
                return communication_prompts_1.communicationPrompts.whatsappMessageGenerator;
            case 'search':
                return search_prompts_1.searchPrompts.naturalLanguageQueryConverter;
            case 'finance':
                return finance_prompts_1.financePrompts.revenueExplainer;
            default:
                return null;
        }
    }
    static getIntentClassifierPrompt() {
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
    static getGeneralAssistantPrompt() {
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
exports.PromptLibrary = PromptLibrary;
//# sourceMappingURL=prompt-library.js.map