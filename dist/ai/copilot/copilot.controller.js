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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const copilot_service_1 = require("./copilot.service");
const copilot_request_dto_1 = require("./dto/copilot-request.dto");
let CopilotController = class CopilotController {
    copilot;
    constructor(copilot) {
        this.copilot = copilot;
    }
    async stream(dto, auth, res) {
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        const r = res;
        if (typeof r.flushHeaders === 'function')
            r.flushHeaders();
        await this.copilot.processStream(dto, auth, res);
    }
    ask(dto, auth) {
        return this.copilot.process(dto, auth);
    }
    health() {
        return { status: 'ok', service: 'MediFlow AI Copilot' };
    }
};
exports.CopilotController = CopilotController;
__decorate([
    (0, common_1.Post)('stream'),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(copilot_request_dto_1.CopilotRequestSchema)),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)({ passthrough: false })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CopilotController.prototype, "stream", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(copilot_request_dto_1.CopilotRequestSchema)),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CopilotController.prototype, "ask", null);
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CopilotController.prototype, "health", null);
exports.CopilotController = CopilotController = __decorate([
    (0, common_1.Controller)('ai/copilot'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [copilot_service_1.CopilotService])
], CopilotController);
//# sourceMappingURL=copilot.controller.js.map