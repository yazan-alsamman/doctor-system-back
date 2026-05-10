export interface LlmRequest {
    systemPrompt: string;
    userMessage: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'json' | 'text';
    model?: string;
}
export interface LlmResponse {
    text: string;
    model: string;
    tokensUsed?: number;
}
export interface LlmProvider {
    readonly name: string;
    generate(request: LlmRequest): Promise<LlmResponse>;
    generateStream?(request: LlmRequest): AsyncGenerator<string, void, unknown>;
}
