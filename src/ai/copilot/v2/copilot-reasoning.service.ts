import { Injectable } from '@nestjs/common';
import { LlmGatewayService } from '../llm/llm-gateway.service';
import type { LlmRequest, LlmResponse } from '../llm/llm.provider.interface';

/**
 * Single entry for Gemini calls — keeps prompts & orchestration out of raw gateway usage.
 */
@Injectable()
export class CopilotReasoningService {
  constructor(private readonly llm: LlmGatewayService) {}

  generate(request: LlmRequest): Promise<LlmResponse> {
    return this.llm.generate(request);
  }

  generateStream(request: LlmRequest): AsyncGenerator<string, void, unknown> {
    return this.llm.generateStream(request);
  }

  parseJson<T>(text: string): T {
    return this.llm.parseJson<T>(text);
  }
}
