import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GeminiProvider } from './providers/gemini.provider';
import type { LlmRequest, LlmResponse } from './llm.provider.interface';

/**
 * Copilot LLM entry — Gemini only. Default model: Gemini 3.1 Flash Lite
 * (`gemini-3.1-flash-lite-preview`), overridable per request or via `GEMINI_MODEL`.
 */
@Injectable()
export class LlmGatewayService {
  private readonly logger = new Logger(LlmGatewayService.name);

  constructor(private readonly gemini: GeminiProvider) {}

  async generate(request: LlmRequest): Promise<LlmResponse> {
    try {
      const result = await this.gemini.generate(request);
      this.logger.debug(`LLM responded (model=${result.model})`);
      return result;
    } catch (err) {
      const msg = String(err);
      if (msg.includes('429') || /quota|rate.?limit/i.test(msg)) {
        throw new ServiceUnavailableException({
          message: 'تجاوزت حصة استخدام الذكاء الاصطناعي للحظة — حاول مجدداً بعد دقيقة.',
          code: 'AI_QUOTA_EXCEEDED',
        });
      }
      if (msg.includes('not configured') || msg.includes('API_KEY')) {
        throw new ServiceUnavailableException({
          message: 'AI service not configured — set GEMINI_API_KEY in .env',
          code: 'AI_NOT_CONFIGURED',
        });
      }
      throw new BadGatewayException({
        message: 'خدمة الذكاء الاصطناعي غير متاحة مؤقتاً — حاول مجدداً.',
        code: 'AI_UPSTREAM_ERROR',
      });
    }
  }

  async *generateStream(request: LlmRequest): AsyncGenerator<string, void, unknown> {
    try {
      yield* this.gemini.generateStream!(request);
      this.logger.debug('LLM stream completed');
    } catch (err) {
      const msg = String(err);
      if (msg.includes('429') || /quota|rate.?limit/i.test(msg)) {
        throw new ServiceUnavailableException({
          message: 'تجاوزت حصة استخدام الذكاء الاصطناعي للحظة — حاول مجدداً بعد دقيقة.',
          code: 'AI_QUOTA_EXCEEDED',
        });
      }
      if (msg.includes('not configured') || msg.includes('API_KEY')) {
        throw new ServiceUnavailableException({
          message: 'AI service not configured — set GEMINI_API_KEY in .env',
          code: 'AI_NOT_CONFIGURED',
        });
      }
      throw new BadGatewayException({
        message: 'AI service unavailable',
        code: 'AI_UPSTREAM_ERROR',
      });
    }
  }

  parseJson<T>(text: string): T {
    const trimmed = text.trim();
    const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
    const body = fence ? fence[1].trim() : trimmed;
    return JSON.parse(body) as T;
  }
}
