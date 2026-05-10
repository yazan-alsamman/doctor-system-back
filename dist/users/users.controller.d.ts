import { UsersService } from './users.service';
import type { AuthContext } from '../common/auth-context';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    list(auth: AuthContext, page?: string, limit?: string): Promise<{
        items: {
            access: import("../common/access/access-matrix").ClinicAccess;
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
    create(auth: AuthContext, body: CreateUserDto): Promise<{
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
    update(auth: AuthContext, id: string, body: UpdateUserDto): Promise<{
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
    toggleActive(auth: AuthContext, id: string): Promise<{
        access: import("../common/access/access-matrix").ClinicAccess;
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
