import type { PromptEntry } from './scheduling.prompts';
import type { IntentType } from '../intent/intent.types';
export type { PromptEntry };
export interface RenderedPrompt {
    systemPrompt: string;
    userMessage: string;
}
export declare class PromptLibrary {
    static readonly scheduling: {
        appointmentLister: {
            id: string;
            system: string;
            user: string;
        };
        smartAdvisor: {
            id: string;
            system: string;
            user: string;
        };
        conflictResolver: {
            id: string;
            system: string;
            user: string;
        };
        appointmentOptimizer: {
            id: string;
            system: string;
            user: string;
        };
    };
    static readonly clinical: {
        patientBriefingSummarizer: {
            id: string;
            system: string;
            user: string;
        };
        riskFlagGenerator: {
            id: string;
            system: string;
            user: string;
        };
        historyAnalyzer: {
            id: string;
            system: string;
            user: string;
        };
    };
    static readonly communication: {
        whatsappMessageGenerator: {
            id: string;
            system: string;
            user: string;
        };
        appointmentReminderGenerator: {
            id: string;
            system: string;
            user: string;
        };
        followUpMessageWriter: {
            id: string;
            system: string;
            user: string;
        };
    };
    static readonly search: {
        naturalLanguageQueryConverter: {
            id: string;
            system: string;
            user: string;
        };
    };
    static readonly finance: {
        revenueExplainer: {
            id: string;
            system: string;
            user: string;
        };
        invoiceSummarizer: {
            id: string;
            system: string;
            user: string;
        };
        usageInsightsGenerator: {
            id: string;
            system: string;
            user: string;
        };
    };
    static render(prompt: PromptEntry, vars: Record<string, string>): RenderedPrompt;
    static selectSchedulingPrompt(input: string): PromptEntry;
    static isListingSchedulingQuery(input: string): boolean;
    static getDefaultForIntent(intent: IntentType): PromptEntry | null;
    static getIntentClassifierPrompt(): string;
    static getGeneralAssistantPrompt(): RenderedPrompt;
}
