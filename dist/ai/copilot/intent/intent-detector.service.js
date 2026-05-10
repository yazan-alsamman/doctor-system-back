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
var IntentDetectorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentDetectorService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const llm_gateway_service_1 = require("../llm/llm-gateway.service");
const prompt_library_1 = require("../prompts/prompt-library");
const intent_rules_1 = require("./intent-rules");
const VALID_INTENTS = new Set([
    'scheduling',
    'clinical',
    'communication',
    'finance',
    'search',
    'general',
]);
const FALLBACK_INTENT = {
    intent: 'general',
    confidence: 'low',
    entities: {},
    language: 'ar',
};
let IntentDetectorService = IntentDetectorService_1 = class IntentDetectorService {
    llm;
    config;
    logger = new common_1.Logger(IntentDetectorService_1.name);
    constructor(llm, config) {
        this.llm = llm;
        this.config = config;
    }
    async detect(input) {
        const fast = (0, intent_rules_1.tryFastIntentClassification)(input);
        if (fast) {
            this.logger.debug(`Intent fast-path: ${fast.intent} (${fast.confidence})`);
            return fast;
        }
        const intentModel = this.config.get('GEMINI_INTENT_MODEL')?.trim();
        try {
            const response = await this.llm.generate({
                systemPrompt: prompt_library_1.PromptLibrary.getIntentClassifierPrompt(),
                userMessage: input,
                temperature: 0.1,
                maxTokens: 256,
                responseFormat: 'json',
                ...(intentModel ? { model: intentModel } : {}),
            });
            const parsed = this.llm.parseJson(response.text);
            if (!parsed.intent || !VALID_INTENTS.has(parsed.intent)) {
                this.logger.warn(`Intent classifier returned unknown intent: ${String(parsed.intent)}`);
                return FALLBACK_INTENT;
            }
            return {
                intent: parsed.intent,
                confidence: parsed.confidence ?? 'low',
                entities: parsed.entities ?? {},
                language: parsed.language ?? 'ar',
            };
        }
        catch (err) {
            this.logger.warn(`Intent detection failed: ${String(err).slice(0, 200)}`);
            return FALLBACK_INTENT;
        }
    }
};
exports.IntentDetectorService = IntentDetectorService;
exports.IntentDetectorService = IntentDetectorService = IntentDetectorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [llm_gateway_service_1.LlmGatewayService,
        config_1.ConfigService])
], IntentDetectorService);
//# sourceMappingURL=intent-detector.service.js.map