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
exports.SuperAdminController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const zod_validation_pipe_1 = require("../common/pipes/zod-validation.pipe");
const tenant_management_service_1 = require("./tenant-management.service");
const tenant_provision_service_1 = require("./tenant-provision.service");
const platform_metrics_service_1 = require("./platform-metrics.service");
const platform_health_service_1 = require("./platform-health.service");
const platform_audit_service_1 = require("./platform-audit.service");
const create_clinic_dto_1 = require("./dto/create-clinic.dto");
const patch_tenant_dto_1 = require("./dto/patch-tenant.dto");
let SuperAdminController = class SuperAdminController {
    tenants;
    provision;
    metrics;
    health;
    audit;
    constructor(tenants, provision, metrics, health, audit) {
        this.tenants = tenants;
        this.provision = provision;
        this.metrics = metrics;
        this.health = health;
        this.audit = audit;
    }
    metricsOverview() {
        return this.metrics.overview();
    }
    healthSnapshot() {
        return this.health.snapshot();
    }
    auditLogs(action, targetTenantId, skip, take) {
        return this.audit.list({
            action,
            targetTenantId,
            skip: skip ? Number(skip) : undefined,
            take: take ? Number(take) : undefined,
        });
    }
    listTenants(search, status, skip, take) {
        return this.tenants.list({
            search,
            status,
            skip: skip ? Number(skip) : undefined,
            take: take ? Number(take) : undefined,
        });
    }
    getTenant(id) {
        return this.tenants.getOne(id);
    }
    createTenant(auth, body) {
        return this.provision.provision(auth.userId, body);
    }
    patchTenant(auth, id, body) {
        return this.tenants.patch(auth.userId, id, body);
    }
    suspendTenant(auth, id) {
        return this.tenants.suspend(auth.userId, id);
    }
    reactivateTenant(auth, id) {
        return this.tenants.reactivate(auth.userId, id);
    }
    softDeleteTenant(auth, id) {
        return this.tenants.softDelete(auth.userId, id);
    }
};
exports.SuperAdminController = SuperAdminController;
__decorate([
    (0, common_1.Get)('metrics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "metricsOverview", null);
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "healthSnapshot", null);
__decorate([
    (0, common_1.Get)('audit-logs'),
    __param(0, (0, common_1.Query)('action')),
    __param(1, (0, common_1.Query)('targetTenantId')),
    __param(2, (0, common_1.Query)('skip')),
    __param(3, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "auditLogs", null);
__decorate([
    (0, common_1.Get)('tenants'),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('skip')),
    __param(3, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "listTenants", null);
__decorate([
    (0, common_1.Get)('tenants/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "getTenant", null);
__decorate([
    (0, common_1.Post)('tenants'),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(create_clinic_dto_1.CreateClinicSchema)),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "createTenant", null);
__decorate([
    (0, common_1.Patch)('tenants/:id'),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(patch_tenant_dto_1.PatchTenantSchema)),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "patchTenant", null);
__decorate([
    (0, common_1.Post)('tenants/:id/suspend'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "suspendTenant", null);
__decorate([
    (0, common_1.Post)('tenants/:id/reactivate'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "reactivateTenant", null);
__decorate([
    (0, common_1.Delete)('tenants/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SuperAdminController.prototype, "softDeleteTenant", null);
exports.SuperAdminController = SuperAdminController = __decorate([
    (0, common_1.Controller)('super-admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.super_admin),
    __metadata("design:paramtypes", [tenant_management_service_1.TenantManagementService,
        tenant_provision_service_1.TenantProvisionService,
        platform_metrics_service_1.PlatformMetricsService,
        platform_health_service_1.PlatformHealthService,
        platform_audit_service_1.PlatformAuditService])
], SuperAdminController);
//# sourceMappingURL=super-admin.controller.js.map