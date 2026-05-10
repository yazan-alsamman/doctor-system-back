import { ConfigService } from '@nestjs/config';
import type { LlmProvider, LlmRequest, LlmResponse } from '../llm.provider.interface';
export declare class GeminiProvider implements LlmProvider {
    private readonly config;
    readonly name = "gemini";
    private readonly logger;
    constructor(config: ConfigService);
    generate(request: LlmRequest): Promise<LlmResponse>;
    generateStream(request: LlmRequest): AsyncGenerator<string, void, unknown>;
}
