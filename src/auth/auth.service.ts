import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma, TenantStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { permissionsForRole } from '../common/role-permissions';
import { mergeFeatureOverrides } from '../common/access/access-matrix';

const loginTenantWhere: Prisma.TenantWhereInput = {
  deletedAt: null,
  status: { in: [TenantStatus.active, TenantStatus.trial] },
};

@Injectable()
export class AuthService {
  private readonly failedLogins = new Map<string, { count: number; until: number }>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string, tenantId?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const rateKey = `${tenantId ?? 'global'}::${normalizedEmail}`;
    this.assertRateLimit(rateKey);

    let users = await this.prisma.user.findMany({
      where: {
        email: normalizedEmail,
        tenantId: tenantId || undefined,
        deletedAt: null,
        active: true,
        tenant: loginTenantWhere,
      },
      include: { tenant: true },
      take: 2,
    });
    if (!users.length && tenantId) {
      const byEmail = await this.prisma.user.findMany({
        where: {
          email: normalizedEmail,
          deletedAt: null,
          active: true,
          tenant: loginTenantWhere,
        },
        include: { tenant: true },
        take: 2,
      });
      if (byEmail.length === 1) {
        users = byEmail;
      } else if (byEmail.length > 1) {
        throw new BadRequestException({
          message: 'Tenant id is required for this account email',
          code: 'TENANT_REQUIRED',
          status: 400,
        });
      }
    }
    if (!users.length) {
      this.bumpFailedAttempts(rateKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!tenantId && users.length > 1) {
      throw new BadRequestException({
        message: 'Tenant id is required for this account email',
        code: 'TENANT_REQUIRED',
        status: 400,
      });
    }

    const user = users[0];

    if (user.role === UserRole.super_admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      this.bumpFailedAttempts(rateKey);
      throw new UnauthorizedException('Invalid credentials');
    }
    this.failedLogins.delete(rateKey);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      doctorCode: user.doctorCode,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        title: user.title,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        doctorCode: user.doctorCode,
        permissions: permissionsForRole(user.role),
        access: mergeFeatureOverrides(user.role, user.featureOverrides),
      },
    };
  }

  private assertRateLimit(key: string) {
    const current = this.failedLogins.get(key);
    if (!current) return;
    const now = Date.now();
    if (current.count >= 5 && current.until > now) {
      throw new HttpException(
        {
          message: 'Too many failed login attempts. Try again later.',
          code: 'AUTH_RATE_LIMIT',
          status: 429,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (current.count >= 5 && current.until <= now) {
      this.failedLogins.delete(key);
    }
  }

  private bumpFailedAttempts(key: string) {
    const current = this.failedLogins.get(key);
    const nextCount = (current?.count ?? 0) + 1;
    if (nextCount < 5) {
      this.failedLogins.set(key, { count: nextCount, until: 0 });
      return;
    }
    this.failedLogins.set(key, {
      count: nextCount,
      until: Date.now() + 15 * 60 * 1000,
    });
  }
}
