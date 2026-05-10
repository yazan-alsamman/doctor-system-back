import { PrismaService } from '../database/prisma.service';
import { AuthContext } from '../common/auth-context';
import { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';
export declare class ServicesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private assertDoctorInTenant;
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
    create(auth: AuthContext, dto: CreateServiceDto): Promise<{
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
    update(auth: AuthContext, id: string, dto: UpdateServiceDto): Promise<{
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
