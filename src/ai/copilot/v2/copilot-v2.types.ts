import type { IntentType } from '../intent/intent.types';
import type { ToolName } from '../tools/tool.types';
import type { DetectedIntent } from '../intent/intent.types';

/** Strict tool invocation — never executed without passing {@link CopilotToolValidatorService}. */
export interface ToolPlan {
  tool: ToolName;
  args: Record<string, unknown>;
  reason: string;
}

export interface CopilotBrainOutput {
  intent: IntentType;
  /** Normalized entities + merged UI context (patientId, doctorId, ranges, …). */
  entities: Record<string, unknown>;
  /** Ordered steps — deterministic selection only (no raw LLM tool names). */
  plans: ToolPlan[];
  /** 0–1 mapping from classifier confidence. */
  confidence: number;
  requires_tools: boolean;
  risk: 'low' | 'medium' | 'high';
  language: DetectedIntent['language'];
  detected: DetectedIntent;
  /** Same payload the registry already consumes today. */
  toolParams: Record<string, unknown>;
}

export interface CopilotMemorySnapshot {
  lastInput?: string;
  lastIntent?: IntentType;
  lastPatientId?: string;
  lastDoctorId?: string;
  /** Short digest for prompt injection (not full rows). */
  lastToolSummary?: string;
  updatedAt: number;
}
