import { PrismaClient } from "@prisma/client";
export declare abstract class PrismaService extends PrismaClient {
}
export declare function createPrismaService(): PrismaService;
