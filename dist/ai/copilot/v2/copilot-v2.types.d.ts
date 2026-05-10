import type { IntentType } from '../intent/intent.types';
import type { ToolName } from '../tools/tool.types';
import type { DetectedIntent } from '../intent/intent.types';
export interface ToolPlan {
    tool: ToolName;
    args: Record<string, unknown>;
    reason: string;
}
export interface CopilotBrainOutput {
    intent: IntentType;
    entities: Record<string, unknown>;
    plans: ToolPlan[];
    confidence: number;
    requires_tools: boolean;
    risk: 'low' | 'medium' | 'high';
    language: DetectedIntent['language'];
    detected: DetectedIntent;
    toolParams: Record<string, unknown>;
}
export interface CopilotMemorySnapshot {
    lastInput?: string;
    lastIntent?: IntentType;
    lastPatientId?: string;
    lastDoctorId?: string;
    lastToolSummary?: string;
    updatedAt: number;
}
