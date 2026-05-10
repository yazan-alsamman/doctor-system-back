import { AuthService } from './auth.service';
import type { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(body: LoginDto): Promise<{
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
}
