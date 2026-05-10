import { LlmGatewayService } from '../llm/llm-gateway.service';
import type { LlmRequest, LlmResponse } from '../llm/llm.provider.interface';
export declare class CopilotReasoningService {
    private readonly llm;
    constructor(llm: LlmGatewayService);
    generate(request: LlmRequest): Promise<LlmResponse>;
    generateStream(request: LlmRequest): AsyncGenerator<string, void, unknown>;
    parseJson<T>(text: string): T;
}
