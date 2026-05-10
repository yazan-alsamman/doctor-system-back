"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../../database/prisma.module");
const copilot_controller_1 = require("./copilot.controller");
const copilot_service_1 = require("./copilot.service");
const intent_detector_service_1 = require("./intent/intent-detector.service");
const tool_registry_service_1 = require("./tools/tool-registry.service");
const context_builder_service_1 = require("./context/context-builder.service");
const llm_gateway_service_1 = require("./llm/llm-gateway.service");
const gemini_provider_1 = require("./llm/providers/gemini.provider");
const copilot_presenter_service_1 = require("./copilot-presenter.service");
const copilot_authorization_service_1 = require("./v2/copilot-authorization.service");
const copilot_policy_service_1 = require("./v2/copilot-policy.service");
const copilot_tool_validator_service_1 = require("./v2/copilot-tool-validator.service");
const copilot_memory_service_1 = require("./v2/copilot-memory.service");
const copilot_execution_engine_1 = require("./v2/copilot-execution.engine");
const copilot_reasoning_service_1 = require("./v2/copilot-reasoning.service");
let CopilotModule = class CopilotModule {
};
exports.CopilotModule = CopilotModule;
exports.CopilotModule = CopilotModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [copilot_controller_1.CopilotController],
        providers: [
            gemini_provider_1.GeminiProvider,
            llm_gateway_service_1.LlmGatewayService,
            copilot_reasoning_service_1.CopilotReasoningService,
            copilot_presenter_service_1.CopilotPresenterService,
            copilot_policy_service_1.CopilotPolicyService,
            copilot_authorization_service_1.CopilotAuthorizationService,
            copilot_tool_validator_service_1.CopilotToolValidatorService,
            copilot_memory_service_1.CopilotMemoryService,
            copilot_execution_engine_1.CopilotExecutionEngine,
            intent_detector_service_1.IntentDetectorService,
            tool_registry_service_1.ToolRegistryService,
            context_builder_service_1.ContextBuilderService,
            copilot_service_1.CopilotService,
        ],
        exports: [copilot_service_1.CopilotService],
    })
], CopilotModule);
//# sourceMappingURL=copilot.module.js.map