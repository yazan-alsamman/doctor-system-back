"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantProvisionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../database/prisma.service");
const platform_tenant_1 = require("../common/constants/platform-tenant");
const platform_audit_service_1 = require("./platform-audit.service");
let TenantProvisionService = class TenantProvisionService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async provision(actorUserId, dto) {
        const email = dto.adminEmail.trim().toLowerCase();
        const dup = await this.prisma.user.findFirst({
            where: {
                email,
                deletedAt: null,
                tenantId: { not: platform_tenant_1.PLATFORM_TENANT_ID },
            },
        });
        if (dup) {
            throw new common_1.BadRequestException({
                message: 'This admin email is already used by another clinic.',
                code: 'EMAIL_TAKEN',
                status: 400,
            });
        }
        const passwordHash = await bcrypt.hash(dto.adminPassword, 10);
        const tenant = await this.prisma.$transaction(async (tx) => {
            const t = await tx.tenant.create({
                data: {
                    name: dto.clinicName.trim(),
                    status: client_1.TenantStatus.trial,
                    plan: dto.plan,
                    subscriptionStatus: client_1.SubscriptionStatus.trial,
                },
            });
            await tx.user.create({
                data: {
                    tenantId: t.id,
                    name: dto.adminName.trim(),
                    email,
                    passwordHash,
                    role: client_1.UserRole.admin,
                    active: true,
                },
            });
            await tx.service.createMany({
                data: [
                    {
                        tenantId: t.id,
                        name: 'Consultation',
                        price: 0,
                        durationMinutes: 30,
                        category: 'general',
                        aliases: ['consultation', 'استشارة'],
                        active: true,
                    },
                    {
                        tenantId: t.id,
                        name: 'Basic treatment',
                        price: 0,
                        durationMinutes: 45,
                        category: 'general',
                        aliases: ['treatment', 'علاج'],
                        active: true,
                    },
                ],
            });
            return t;
        });
        await this.audit.log('CLINIC_CREATED', actorUserId, tenant.id, {
            clinicName: tenant.name,
            plan: dto.plan,
            adminEmail: email,
        });
        return {
            tenantId: tenant.id,
            tenantName: tenant.name,
            plan: tenant.plan,
            status: tenant.status,
            adminEmail: email,
            message: 'Clinic provisioned. Default services added; add doctors in the clinic app to enable schedules.',
        };
    }
};
exports.TenantProvisionService = TenantProvisionService;
exports.TenantProvisionService = TenantProvisionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        platform_audit_service_1.PlatformAuditService])
], TenantProvisionService);
//# sourceMappingURL=tenant-provision.service.js.map