import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmGatewayService } from '../llm/llm-gateway.service';
import { PromptLibrary } from '../prompts/prompt-library';
import { tryFastIntentClassification } from './intent-rules';
import type { DetectedIntent, IntentType } from './intent.types';

const VALID_INTENTS = new Set<IntentType>([
  'scheduling',
  'clinical',
  'communication',
  'finance',
  'search',
  'general',
]);

const FALLBACK_INTENT: DetectedIntent = {
  intent: 'general',
  confidence: 'low',
  entities: {},
  language: 'ar',
};

@Injectable()
export class IntentDetectorService {
  private readonly logger = new Logger(IntentDetectorService.name);

  constructor(
    private readonly llm: LlmGatewayService,
    private readonly config: ConfigService,
  ) {}

  async detect(input: string): Promise<DetectedIntent> {
    const fast = tryFastIntentClassification(input);
    if (fast) {
      this.logger.debug(`Intent fast-path: ${fast.intent} (${fast.confidence})`);
      return fast;
    }

    const intentModel = this.config.get<string>('GEMINI_INTENT_MODEL')?.trim();

    try {
      const response = await this.llm.generate({
        systemPrompt: PromptLibrary.getIntentClassifierPrompt(),
        userMessage: input,
        temperature: 0.1,
        maxTokens: 256,
        responseFormat: 'json',
        ...(intentModel ? { model: intentModel } : {}),
      });

      const parsed = this.llm.parseJson<Partial<DetectedIntent>>(response.text);

      if (!parsed.intent || !VALID_INTENTS.has(parsed.intent as IntentType)) {
        this.logger.warn(`Intent classifier returned unknown intent: ${String(parsed.intent)}`);
        return FALLBACK_INTENT;
      }

      return {
        intent: parsed.intent as IntentType,
        confidence: parsed.confidence ?? 'low',
        entities: parsed.entities ?? {},
        language: parsed.language ?? 'ar',
      };
    } catch (err) {
      this.logger.warn(`Intent detection failed: ${String(err).slice(0, 200)}`);
      return FALLBACK_INTENT;
    }
  }
}
