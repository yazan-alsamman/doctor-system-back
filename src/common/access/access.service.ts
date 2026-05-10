import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../auth-context';
import { tenantWhere } from '../tenant-prisma.helper';
import { getAccessPath, mergeFeatureOverrides } from './access-matrix';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assert(auth: AuthContext, dotPath: string) {
    const row = await this.prisma.user.findFirst({
      where: tenantWhere(auth.tenantId, { id: auth.userId }),
      select: { role: true, featureOverrides: true },
    });
    if (!row) {
      throw new ForbiddenException({ message: 'User not found', code: 'FORBIDDEN', status: 403 });
    }
    const access = mergeFeatureOverrides(row.role, row.featureOverrides);
    if (!getAccessPath(access, dotPath)) {
      throw new ForbiddenException({
        message: 'You do not have permission for this action',
        code: 'ACCESS_DENIED',
        status: 403,
      });
    }
  }
}
