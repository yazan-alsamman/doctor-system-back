import { type SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { SuperAdminAuthService } from './super-admin-auth.service';
export declare class SuperAdminAuthController {
    private readonly auth;
    constructor(auth: SuperAdminAuthService);
    login(body: SuperAdminLoginDto): Promise<{
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
}
