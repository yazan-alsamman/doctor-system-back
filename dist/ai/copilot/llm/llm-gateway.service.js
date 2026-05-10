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
var LlmGatewayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmGatewayService = void 0;
const common_1 = require("@nestjs/common");
const gemini_provider_1 = require("./providers/gemini.provider");
let LlmGatewayService = LlmGatewayService_1 = class LlmGatewayService {
    gemini;
    logger = new common_1.Logger(LlmGatewayService_1.name);
    constructor(gemini) {
        this.gemini = gemini;
    }
    async generate(request) {
        try {
            const result = await this.gemini.generate(request);
            this.logger.debug(`LLM responded (model=${result.model})`);
            return result;
        }
        catch (err) {
            const msg = String(err);
            if (msg.includes('429') || /quota|rate.?limit/i.test(msg)) {
                throw new common_1.ServiceUnavailableException({
                    message: 'تجاوزت حصة استخدام الذكاء الاصطناعي للحظة — حاول مجدداً بعد دقيقة.',
                    code: 'AI_QUOTA_EXCEEDED',
                });
            }
            if (msg.includes('not configured') || msg.includes('API_KEY')) {
                throw new common_1.ServiceUnavailableException({
                    message: 'AI service not configured — set GEMINI_API_KEY in .env',
                    code: 'AI_NOT_CONFIGURED',
                });
            }
            throw new common_1.BadGatewayException({
                message: 'خدمة الذكاء الاصطناعي غير متاحة مؤقتاً — حاول مجدداً.',
                code: 'AI_UPSTREAM_ERROR',
            });
        }
    }
    async *generateStream(request) {
        try {
            yield* this.gemini.generateStream(request);
            this.logger.debug('LLM stream completed');
        }
        catch (err) {
            const msg = String(err);
            if (msg.includes('429') || /quota|rate.?limit/i.test(msg)) {
                throw new common_1.ServiceUnavailableException({
                    message: 'تجاوزت حصة استخدام الذكاء الاصطناعي للحظة — حاول مجدداً بعد دقيقة.',
                    code: 'AI_QUOTA_EXCEEDED',
                });
            }
            if (msg.includes('not configured') || msg.includes('API_KEY')) {
                throw new common_1.ServiceUnavailableException({
                    message: 'AI service not configured — set GEMINI_API_KEY in .env',
                    code: 'AI_NOT_CONFIGURED',
                });
            }
            throw new common_1.BadGatewayException({
                message: 'AI service unavailable',
                code: 'AI_UPSTREAM_ERROR',
            });
        }
    }
    parseJson(text) {
        const trimmed = text.trim();
        const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
        const body = fence ? fence[1].trim() : trimmed;
        return JSON.parse(body);
    }
};
exports.LlmGatewayService = LlmGatewayService;
exports.LlmGatewayService = LlmGatewayService = LlmGatewayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [gemini_provider_1.GeminiProvider])
], LlmGatewayService);
//# sourceMappingURL=llm-gateway.service.js.map