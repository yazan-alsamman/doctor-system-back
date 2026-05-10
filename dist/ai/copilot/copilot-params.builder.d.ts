import type { CopilotRequestDto } from './dto/copilot-request.dto';
import type { DetectedIntent } from './intent/intent.types';
export declare function clinicCalendarToday(d?: Date): string;
export declare function resolveToolParams(dto: CopilotRequestDto, intent: DetectedIntent): Record<string, unknown>;
