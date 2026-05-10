import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import type { SuperAdminLoginDto } from './dto/super-admin-login.dto';
export declare class SuperAdminAuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly failedLogins;
    constructor(prisma: PrismaService, jwtService: JwtService);
    login(dto: SuperAdminLoginDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            name: string;
            title: string | null;
            email: string;
            role: import("@prisma/client").$Enums.UserRole;
            tenantId: string;
            doctorCode: string | null;
        };
    }>;
    private assertRateLimit;
    private bumpFailedAttempts;
}
