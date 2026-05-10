"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotPolicyService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const tool_plan_schema_1 = require("./tool-plan.schema");
const DOCTOR_FINANCE_TOOLS = new Set([
    'getInvoiceData',
    'getRevenueStats',
]);
let CopilotPolicyService = class CopilotPolicyService {
    allowedTools(role) {
        if (role === client_1.UserRole.doctor) {
            return new Set(tool_plan_schema_1.ALL_TOOL_NAMES.filter((t) => !DOCTOR_FINANCE_TOOLS.has(t)));
        }
        return new Set(tool_plan_schema_1.ALL_TOOL_NAMES);
    }
    intentAllowedForRole(role, intent) {
        if (role === client_1.UserRole.doctor && intent === 'finance') {
            return false;
        }
        return true;
    }
    intentSensitivity(intent) {
        return intent === 'clinical' || intent === 'finance' ? 'high' : 'normal';
    }
};
exports.CopilotPolicyService = CopilotPolicyService;
exports.CopilotPolicyService = CopilotPolicyService = __decorate([
    (0, common_1.Injectable)()
], CopilotPolicyService);
//# sourceMappingURL=copilot-policy.service.js.map