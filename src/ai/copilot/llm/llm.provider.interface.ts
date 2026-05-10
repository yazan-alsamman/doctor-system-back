export interface LlmRequest {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
  /** Gemini model id override for this request (e.g. faster model for intent-only calls). */
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
  /** Token deltas from Gemini streaming (optional). */
  generateStream?(request: LlmRequest): AsyncGenerator<string, void, unknown>;
}
