import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly failedLogins;
    constructor(prisma: PrismaService, jwtService: JwtService);
    login(email: string, password: string, tenantId?: string): Promise<{
        accessToken: string;
        user: {
            id: string;
            name: string;
            title: string | null;
            email: string;
            role: "admin" | "doctor" | "receptionist";
            tenantId: string;
            doctorCode: string | null;
            permissions: import("../common/role-permissions").RolePermissions;
            access: import("../common/access/access-matrix").ClinicAccess;
        };
    }>;
    private assertRateLimit;
    private bumpFailedAttempts;
}
