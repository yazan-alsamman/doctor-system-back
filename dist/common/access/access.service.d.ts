import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../auth-context';
export declare class AccessService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    assert(auth: AuthContext, dotPath: string): Promise<void>;
}
