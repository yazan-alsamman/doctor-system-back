import type { AuthContext } from '../common/auth-context';
import { UsersService } from './users.service';
import { type PatchPasswordDto, type PatchProfileDto } from './dto/account.dto';
export declare class AccountController {
    private readonly usersService;
    constructor(usersService: UsersService);
    me(auth: AuthContext): Promise<{
        permissions: import("../common/role-permissions").RolePermissions;
        access: import("../common/access/access-matrix").ClinicAccess;
        id: string;
        name: string;
        createdAt: Date;
        title: string | null;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        active: boolean;
        doctorCode: string | null;
    }>;
    patchProfile(auth: AuthContext, body: PatchProfileDto): Promise<{
        permissions: import("../common/role-permissions").RolePermissions;
        access: import("../common/access/access-matrix").ClinicAccess;
        id: string;
        name: string;
        createdAt: Date;
        title: string | null;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        active: boolean;
        doctorCode: string | null;
    }>;
    patchPassword(auth: AuthContext, body: PatchPasswordDto): Promise<{
        ok: boolean;
    }>;
}
