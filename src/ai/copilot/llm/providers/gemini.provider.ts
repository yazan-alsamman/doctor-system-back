import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LlmProvider, LlmRequest, LlmResponse } from '../llm.provider.interface';

/** Google API model id for Gemini 3.1 Flash Lite (preview). */
const DEFAULT_MODEL = 'gemini-3.1-flash-lite-preview';
/** Shorter backoff keeps quota retries from adding ~8s to every copilot turn */
const RETRY_DELAYS_MS = [280, 720, 1600] as const;

function isRetryable(err: unknown): boolean {
  const s = String(err);
  return s.includes('429') || /quota|rate\s*limit/i.test(s);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(private readonly config: ConfigService) {}

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const apiKey =
      this.config.get<string>('GEMINI_API_KEY')?.trim() ||
      process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const modelId =
      request.model?.trim() ||
      this.config.get<string>('GEMINI_MODEL')?.trim() ||
      DEFAULT_MODEL;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelId,
      generationConfig: {
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? 2048,
        ...(request.responseFormat === 'json'
          ? { responseMimeType: 'application/json' as const }
          : {}),
      },
      systemInstruction: request.systemPrompt,
    });

    let lastErr: unknown;
    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
      try {
        const result = await model.generateContent(request.userMessage);
        return { text: result.response.text(), model: modelId };
      } catch (err) {
        lastErr = err;
        this.logger.warn(
          `Gemini attempt ${attempt + 1} failed (model=${modelId}): ${String(err).slice(0, 200)}`,
        );
        if (String(err).includes('429')) break;
        if (isRetryable(err) && attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        break;
      }
    }

    throw lastErr;
  }

  async *generateStream(request: LlmRequest): AsyncGenerator<string, void, unknown> {
    const apiKey =
      this.config.get<string>('GEMINI_API_KEY')?.trim() ||
      process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const modelId =
      request.model?.trim() ||
      this.config.get<string>('GEMINI_MODEL')?.trim() ||
      DEFAULT_MODEL;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelId,
      generationConfig: {
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? 2048,
        ...(request.responseFormat === 'json'
          ? { responseMimeType: 'application/json' as const }
          : {}),
      },
      systemInstruction: request.systemPrompt,
    });

    let lastErr: unknown;
    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
      try {
        const streamResult = await model.generateContentStream(request.userMessage);
        for await (const chunk of streamResult.stream) {
          const t = chunk.text();
          if (t) yield t;
        }
        return;
      } catch (err) {
        lastErr = err;
        this.logger.warn(
          `Gemini stream attempt ${attempt + 1} failed (model=${modelId}): ${String(err).slice(0, 200)}`,
        );
        if (String(err).includes('429')) break;
        if (isRetryable(err) && attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        break;
      }
    }

    throw lastErr;
  }
}
