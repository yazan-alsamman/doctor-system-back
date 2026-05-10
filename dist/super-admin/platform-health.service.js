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
exports.PlatformHealthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
let PlatformHealthService = class PlatformHealthService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async snapshot() {
        const dbOk = await this.pingDb();
        const lastBackupAt = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        const errorLogCount = 0;
        return {
            api: { status: 'up' },
            database: { status: dbOk ? 'up' : 'down' },
            lastBackupAt,
            errorLogCount,
        };
    }
    async pingDb() {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return true;
        }
        catch {
            return false;
        }
    }
};
exports.PlatformHealthService = PlatformHealthService;
exports.PlatformHealthService = PlatformHealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PlatformHealthService);
//# sourceMappingURL=platform-health.service.js.map