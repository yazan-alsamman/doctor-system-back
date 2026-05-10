import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { PLATFORM_TENANT_ID } from '../common/constants/platform-tenant';
import type { SuperAdminLoginDto } from './dto/super-admin-login.dto';

@Injectable()
export class SuperAdminAuthService {
  private readonly failedLogins = new Map<string, { count: number; until: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: SuperAdminLoginDto) {
    const email = dto.email.trim().toLowerCase();
    const rateKey = `super::${email}`;
    this.assertRateLimit(rateKey);

    const user = await this.prisma.user.findFirst({
      where: {
        email,
        tenantId: PLATFORM_TENANT_ID,
        role: UserRole.super_admin,
        deletedAt: null,
        active: true,
        tenant: { id: PLATFORM_TENANT_ID, deletedAt: null },
      },
      include: { tenant: true },
    });

    if (!user) {
      this.bumpFailedAttempts(rateKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
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
