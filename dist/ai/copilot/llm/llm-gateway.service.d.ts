import { GeminiProvider } from './providers/gemini.provider';
import type { LlmRequest, LlmResponse } from './llm.provider.interface';
export declare class LlmGatewayService {
    private readonly gemini;
    private readonly logger;
    constructor(gemini: GeminiProvider);
    generate(request: LlmRequest): Promise<LlmResponse>;
    generateStream(request: LlmRequest): AsyncGenerator<string, void, unknown>;
    parseJson<T>(text: string): T;
}
