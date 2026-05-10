import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TenantStatus, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

type JwtPayload = {
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
  doctorCode?: string | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        deletedAt: null,
        active: true,
        tenant: {
          deletedAt: null,
          status: { in: [TenantStatus.active, TenantStatus.trial] },
        },
      },
      select: {
        id: true,
        tenantId: true,
        role: true,
        email: true,
        doctorCode: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Session is no longer valid');
    }
    return {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      doctorCode: user.doctorCode ?? null,
    };
  }
}
