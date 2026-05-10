import { UserRole } from "@prisma/client";
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
type JwtPayload = {
    sub: string;
    tenantId: string;
    role: UserRole;
    email: string;
    doctorCode?: string | null;
};
declare const JwtStrategy_base: new (...args: any) => any;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly prisma;
    constructor(configService: ConfigService, prisma: PrismaService);
    validate(payload: JwtPayload): Promise<{
        userId: string;
        tenantId: string;
        role: import("@prisma/client").$Enums.UserRole;
        email: string;
        doctorCode: string | null;
    }>;
}
export {};
