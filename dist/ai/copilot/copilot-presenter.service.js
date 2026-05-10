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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotPresenterService = void 0;
const common_1 = require("@nestjs/common");
const copilot_response_composer_1 = require("./copilot-response-composer");
const copilot_reasoning_service_1 = require("./v2/copilot-reasoning.service");
let CopilotPresenterService = class CopilotPresenterService {
    reasoning;
    constructor(reasoning) {
        this.reasoning = reasoning;
    }
    composeFromLlmJson(rawText, intent, options) {
        const fallback = rawText.trim() || '—';
        if (intent === 'general') {
            return { response: fallback, structuredData: null };
        }
        try {
            const parsed = this.reasoning.parseJson(rawText);
            const composed = (0, copilot_response_composer_1.composeCopilotAnswer)(parsed, rawText, {
                language: options?.language,
            });
            return {
                response: composed.response,
                structuredData: {
                    ...parsed,
                    ...(Object.keys(composed.copilot_hints).length
                        ? { copilot_hints: composed.copilot_hints }
                        : {}),
                },
            };
        }
        catch {
            return {
                response: (0, copilot_response_composer_1.extractPrimaryAssistantText)(rawText),
                structuredData: null,
            };
        }
    }
    buildSearchNarrative(tool, data, error, displayQuery, language) {
        return (0, copilot_response_composer_1.buildSearchNarrative)(tool, data, error, displayQuery, language);
    }
};
exports.CopilotPresenterService = CopilotPresenterService;
exports.CopilotPresenterService = CopilotPresenterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [copilot_reasoning_service_1.CopilotReasoningService])
], CopilotPresenterService);
//# sourceMappingURL=copilot-presenter.service.js.map