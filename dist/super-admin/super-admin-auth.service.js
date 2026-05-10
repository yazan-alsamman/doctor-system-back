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
exports.SuperAdminAuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../database/prisma.service");
const platform_tenant_1 = require("../common/constants/platform-tenant");
let SuperAdminAuthService = class SuperAdminAuthService {
    prisma;
    jwtService;
    failedLogins = new Map();
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async login(dto) {
        const email = dto.email.trim().toLowerCase();
        const rateKey = `super::${email}`;
        this.assertRateLimit(rateKey);
        const user = await this.prisma.user.findFirst({
            where: {
                email,
                tenantId: platform_tenant_1.PLATFORM_TENANT_ID,
                role: client_1.UserRole.super_admin,
                deletedAt: null,
                active: true,
                tenant: { id: platform_tenant_1.PLATFORM_TENANT_ID, deletedAt: null },
            },
            include: { tenant: true },
        });
        if (!user) {
            this.bumpFailedAttempts(rateKey);
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const ok = await bcrypt.compare(dto.password, user.passwordHash);
        if (!ok) {
            this.bumpFailedAttempts(rateKey);
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        this.failedLogins.delete(rateKey);
        const accessToken = await this.jwtService.signAsync({
            sub: user.id,
            tenantId: user.tenantId,
            role: user.role,
            email: user.email,
            doctorCode: user.doctorCode,
        });
        return {
            accessToken,
            user: {
                id: user.id,
                name: user.name,
                title: user.title,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
                doctorCode: user.doctorCode,
            },
        };
    }
    assertRateLimit(key) {
        const current = this.failedLogins.get(key);
        if (!current)
            return;
        const now = Date.now();
        if (current.count >= 5 && current.until > now) {
            throw new common_1.HttpException({
                message: 'Too many failed login attempts. Try again later.',
                code: 'AUTH_RATE_LIMIT',
                status: 429,
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        if (current.count >= 5 && current.until <= now) {
            this.failedLogins.delete(key);
        }
    }
    bumpFailedAttempts(key) {
        const current = this.failedLogins.get(key);
        const nextCount = (current?.count ?? 0) + 1;
        if (nextCount < 5) {
            this.failedLogins.set(key, { count: nextCount, until: 0 });
            return;
        }
        this.failedLogins.set(key, {
            count: nextCount,
            until: Date.now() + 15 * 60 * 1000,
        });
    }
};
exports.SuperAdminAuthService = SuperAdminAuthService;
exports.SuperAdminAuthService = SuperAdminAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], SuperAdminAuthService);
//# sourceMappingURL=super-admin-auth.service.js.map