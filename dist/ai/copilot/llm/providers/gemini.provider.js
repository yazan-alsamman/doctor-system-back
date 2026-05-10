"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GeminiProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const generative_ai_1 = require("@google/generative-ai");
const DEFAULT_MODEL = 'gemini-3.1-flash-lite-preview';
const RETRY_DELAYS_MS = [280, 720, 1600];
function isRetryable(err) {
    const s = String(err);
    return s.includes('429') || /quota|rate\s*limit/i.test(s);
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
let GeminiProvider = GeminiProvider_1 = class GeminiProvider {
    config;
    name = 'gemini';
    logger = new common_1.Logger(GeminiProvider_1.name);
    constructor(config) {
        this.config = config;
    }
    async generate(request) {
        const apiKey = this.config.get('GEMINI_API_KEY')?.trim() ||
            process.env.GEMINI_API_KEY?.trim();
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured');
        }
        const modelId = request.model?.trim() ||
            this.config.get('GEMINI_MODEL')?.trim() ||
            DEFAULT_MODEL;
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: modelId,
            generationConfig: {
                temperature: request.temperature ?? 0.3,
                maxOutputTokens: request.maxTokens ?? 2048,
                ...(request.responseFormat === 'json'
                    ? { responseMimeType: 'application/json' }
                    : {}),
            },
            systemInstruction: request.systemPrompt,
        });
        let lastErr;
        for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
            try {
                const result = await model.generateContent(request.userMessage);
                return { text: result.response.text(), model: modelId };
            }
            catch (err) {
                lastErr = err;
                this.logger.warn(`Gemini attempt ${attempt + 1} failed (model=${modelId}): ${String(err).slice(0, 200)}`);
                if (String(err).includes('429'))
                    break;
                if (isRetryable(err) && attempt < RETRY_DELAYS_MS.length) {
                    await sleep(RETRY_DELAYS_MS[attempt]);
                    continue;
                }
                break;
            }
        }
        throw lastErr;
    }
    async *generateStream(request) {
        const apiKey = this.config.get('GEMINI_API_KEY')?.trim() ||
            process.env.GEMINI_API_KEY?.trim();
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured');
        }
        const modelId = request.model?.trim() ||
            this.config.get('GEMINI_MODEL')?.trim() ||
            DEFAULT_MODEL;
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: modelId,
            generationConfig: {
                temperature: request.temperature ?? 0.3,
                maxOutputTokens: request.maxTokens ?? 2048,
                ...(request.responseFormat === 'json'
                    ? { responseMimeType: 'application/json' }
                    : {}),
            },
            systemInstruction: request.systemPrompt,
        });
        let lastErr;
        for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
            try {
                const streamResult = await model.generateContentStream(request.userMessage);
                for await (const chunk of streamResult.stream) {
                    const t = chunk.text();
                    if (t)
                        yield t;
                }
                return;
            }
            catch (err) {
                lastErr = err;
                this.logger.warn(`Gemini stream attempt ${attempt + 1} failed (model=${modelId}): ${String(err).slice(0, 200)}`);
                if (String(err).includes('429'))
                    break;
                if (isRetryable(err) && attempt < RETRY_DELAYS_MS.length) {
                    await sleep(RETRY_DELAYS_MS[attempt]);
                    continue;
                }
                break;
            }
        }
        throw lastErr;
    }
};
exports.GeminiProvider = GeminiProvider;
exports.GeminiProvider = GeminiProvider = GeminiProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GeminiProvider);
//# sourceMappingURL=gemini.provider.js.map