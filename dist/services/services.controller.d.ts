import { ServicesService } from './services.service';
import type { AuthContext } from '../common/auth-context';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';
export declare class ServicesController {
    private readonly servicesService;
    constructor(servicesService: ServicesService);
    list(auth: AuthContext, doctorId?: string): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        tenantId: string;
        active: boolean;
        doctorId: string | null;
        price: import("@prisma/client-runtime-utils").Decimal;
        durationMinutes: number;
        category: string;
        aliases: string[];
    }[]>;
    create(auth: AuthContext, body: CreateServiceDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        tenantId: string;
        active: boolean;
        doctorId: string | null;
        price: import("@prisma/client-runtime-utils").Decimal;
        durationMinutes: number;
        category: string;
        aliases: string[];
    }>;
    update(auth: AuthContext, id: string, body: UpdateServiceDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        tenantId: string;
        active: boolean;
        doctorId: string | null;
        price: import("@prisma/client-runtime-utils").Decimal;
        durationMinutes: number;
        category: string;
        aliases: string[];
    } | null>;
    remove(auth: AuthContext, id: string): import("@prisma/client").Prisma.PrismaPromise<import("@prisma/client").Prisma.BatchPayload>;
}
