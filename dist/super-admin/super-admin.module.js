"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperAdminModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const prisma_module_1 = require("../database/prisma.module");
const super_admin_auth_controller_1 = require("./super-admin-auth.controller");
const super_admin_auth_service_1 = require("./super-admin-auth.service");
const super_admin_controller_1 = require("./super-admin.controller");
const tenant_management_service_1 = require("./tenant-management.service");
const tenant_provision_service_1 = require("./tenant-provision.service");
const platform_audit_service_1 = require("./platform-audit.service");
const platform_metrics_service_1 = require("./platform-metrics.service");
const platform_health_service_1 = require("./platform-health.service");
let SuperAdminModule = class SuperAdminModule {
};
exports.SuperAdminModule = SuperAdminModule;
exports.SuperAdminModule = SuperAdminModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, auth_module_1.AuthModule],
        controllers: [super_admin_auth_controller_1.SuperAdminAuthController, super_admin_controller_1.SuperAdminController],
        providers: [
            super_admin_auth_service_1.SuperAdminAuthService,
            tenant_management_service_1.TenantManagementService,
            tenant_provision_service_1.TenantProvisionService,
            platform_audit_service_1.PlatformAuditService,
            platform_metrics_service_1.PlatformMetricsService,
            platform_health_service_1.PlatformHealthService,
        ],
    })
], SuperAdminModule);
//# sourceMappingURL=super-admin.module.js.map