import { PrismaService } from '../database/prisma.service';
import { AuthContext } from '../common/auth-context';
import { ClinicAccess } from '../common/access/access-matrix';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { PatchPasswordDto, PatchProfileDto } from './dto/account.dto';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getSelf(auth: AuthContext): Promise<{
        permissions: import("../common/role-permissions").RolePermissions;
        access: ClinicAccess;
        id: string;
        name: string;
        createdAt: Date;
        title: string | null;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        active: boolean;
        doctorCode: string | null;
    }>;
    updateSelf(auth: AuthContext, dto: PatchProfileDto): Promise<{
        permissions: import("../common/role-permissions").RolePermissions;
        access: ClinicAccess;
        id: string;
        name: string;
        createdAt: Date;
        title: string | null;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        active: boolean;
        doctorCode: string | null;
    }>;
    changeOwnPassword(auth: AuthContext, dto: PatchPasswordDto): Promise<{
        ok: boolean;
    }>;
    list(auth: AuthContext, query?: {
        page?: number;
        limit?: number;
    }): Promise<{
        items: {
            access: ClinicAccess;
            id: string;
            name: string;
            createdAt: Date;
            title: string | null;
            email: string;
            role: import("@prisma/client").$Enums.UserRole;
            active: boolean;
            doctorCode: string | null;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    create(auth: AuthContext, dto: CreateUserDto): Promise<{
        access: ClinicAccess;
        id: string;
        name: string;
        createdAt: Date;
        title: string | null;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        active: boolean;
        doctorCode: string | null;
    }>;
    update(auth: AuthContext, id: string, dto: UpdateUserDto): Promise<{
        access: ClinicAccess;
        id: string;
        name: string;
        createdAt: Date;
        title: string | null;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        active: boolean;
        doctorCode: string | null;
    }>;
    toggleActive(auth: AuthContext, id: string): Promise<{
        access: ClinicAccess;
        id: string;
        name: string;
        createdAt: Date;
        title: string | null;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        active: boolean;
        doctorCode: string | null;
    } | null>;
}
