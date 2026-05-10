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
exports.CopilotToolValidatorService = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const tool_plan_schema_1 = require("./tool-plan.schema");
const copilot_policy_service_1 = require("./copilot-policy.service");
const search_tool_args_1 = require("./search-tool-args");
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
let CopilotToolValidatorService = class CopilotToolValidatorService {
    policy;
    constructor(policy) {
        this.policy = policy;
    }
    validateAndParse(plan, auth) {
        const allowed = this.policy.allowedTools(auth.role);
        if (!allowed.has(plan.tool)) {
            throw new common_1.ForbiddenException({
                message: 'Tool not allowed for this role',
                code: 'COPILOT_TOOL_FORBIDDEN',
                status: 403,
            });
        }
        const safeArgs = this.sanitizeArgs(plan.args);
        const candidate = { ...plan, args: safeArgs };
        const parsed = tool_plan_schema_1.ToolPlanSchema.safeParse(candidate);
        if (!parsed.success) {
            throw new common_1.BadRequestException({
                message: 'Invalid tool plan',
                code: 'COPILOT_PLAN_INVALID',
                status: 400,
                details: parsed.error.flatten(),
            });
        }
        const base = parsed.data;
        if ((0, search_tool_args_1.isSearchToolName)(base.tool)) {
            const args = (0, search_tool_args_1.assertSearchExecutionArgs)(base.tool, base.args);
            this.assertUuidLikeIds(base.tool, args);
            return { ...base, args };
        }
        this.assertUuidLikeIds(base.tool, base.args);
        return base;
    }
    sanitizeArgs(args) {
        const out = {};
        let n = 0;
        for (const [k, v] of Object.entries(args)) {
            if (n++ > 80)
                break;
            if (FORBIDDEN.has(k))
                continue;
            if (k.length > 256)
                continue;
            out[k] = v;
        }
        return out;
    }
    assertUuidLikeIds(tool, args) {
        for (const key of ['patientId', 'doctorId']) {
            const v = args[key];
            if (v === undefined || v === null)
                continue;
            const s = String(v).trim();
            if (!s)
                continue;
            if (!zod_1.z.string().uuid().safeParse(s).success) {
                throw new common_1.BadRequestException({
                    message: `Invalid ${key} (expected UUID)`,
                    code: 'COPILOT_ID_INVALID',
                    status: 400,
                    details: { tool, key },
                });
            }
        }
    }
};
exports.CopilotToolValidatorService = CopilotToolValidatorService;
exports.CopilotToolValidatorService = CopilotToolValidatorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [copilot_policy_service_1.CopilotPolicyService])
], CopilotToolValidatorService);
//# sourceMappingURL=copilot-tool-validator.service.js.map