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
var CopilotExecutionEngine_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotExecutionEngine = void 0;
const common_1 = require("@nestjs/common");
const tool_registry_service_1 = require("../tools/tool-registry.service");
const copilot_tool_validator_service_1 = require("./copilot-tool-validator.service");
let CopilotExecutionEngine = CopilotExecutionEngine_1 = class CopilotExecutionEngine {
    registry;
    validator;
    logger = new common_1.Logger(CopilotExecutionEngine_1.name);
    constructor(registry, validator) {
        this.registry = registry;
        this.validator = validator;
    }
    async execute(auth, plans) {
        const results = [];
        const settled = await Promise.allSettled(plans.map(async (plan) => {
            const validated = this.validator.validateAndParse(plan, auth);
            return this.registry.executeTool(validated.tool, auth, validated.args);
        }));
        settled.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            }
            else {
                this.logger.warn(`Plan ${plans[i]?.tool} failed: ${String(result.reason).slice(0, 180)}`);
                results.push({
                    tool: plans[i].tool,
                    data: null,
                    error: 'validation_or_execution_failed',
                });
            }
        });
        return results;
    }
};
exports.CopilotExecutionEngine = CopilotExecutionEngine;
exports.CopilotExecutionEngine = CopilotExecutionEngine = CopilotExecutionEngine_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tool_registry_service_1.ToolRegistryService,
        copilot_tool_validator_service_1.CopilotToolValidatorService])
], CopilotExecutionEngine);
//# sourceMappingURL=copilot-execution.engine.js.map