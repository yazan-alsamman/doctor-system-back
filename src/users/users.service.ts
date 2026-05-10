import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthContext } from '../common/auth-context';
import { tenantWhere } from '../common/tenant-prisma.helper';
import { permissionsForRole } from '../common/role-permissions';
import {
  ClinicAccess,
  diffPartialAccess,
  mergeFeatureOverrides,
} from '../common/access/access-matrix';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { PatchPasswordDto, PatchProfileDto } from './dto/account.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getSelf(auth: AuthContext) {
    const user = await this.prisma.user.findFirst({
      where: tenantWhere(auth.tenantId, { id: auth.userId }),
      select: {
        id: true,
        name: true,
        title: true,
        email: true,
        role: true,
        active: true,
        doctorCode: true,
        createdAt: true,
        featureOverrides: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { featureOverrides, ...rest } = user;
    const access = mergeFeatureOverrides(user.role, featureOverrides);
    return {
      ...rest,
      permissions: permissionsForRole(user.role),
      access,
    };
  }

  async updateSelf(auth: AuthContext, dto: PatchProfileDto) {
    await this.prisma.user.updateMany({
      where: tenantWhere(auth.tenantId, { id: auth.userId }),
      data: { name: dto.name.trim() },
    });
    return this.getSelf(auth);
  }

  async changeOwnPassword(auth: AuthContext, dto: PatchPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: tenantWhere(auth.tenantId, { id: auth.userId }),
    });
    if (!user) throw new NotFoundException('User not found');
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        message: 'Current password is incorrect',
        code: 'INVALID_PASSWORD',
        status: 401,
      });
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.updateMany({
      where: tenantWhere(auth.tenantId, { id: auth.userId }),
      data: { passwordHash },
    });
    return { ok: true };
  }

  async list(auth: AuthContext, query?: { page?: number; limit?: number }) {
    const page = Math.max(1, Number(query?.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query?.limit || 50)));
    const where = tenantWhere(auth.tenantId);

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          title: true,
          email: true,
          role: true,
          active: true,
          doctorCode: true,
          createdAt: true,
          featureOverrides: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map((u) => {
        const access = mergeFeatureOverrides(u.role, u.featureOverrides);
        const { featureOverrides: _fo, ...rest } = u;
        return { ...rest, access };
      }),
      meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async create(auth: AuthContext, dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.prisma.user.create({
      data: {
        id: dto.id,
        tenantId: auth.tenantId,
        name: dto.name,
        title: dto.title,
        email: dto.email.toLowerCase(),
        role: dto.role,
        passwordHash,
        active: true,
        doctorCode: dto.role === 'doctor' ? dto.doctorCode || null : null,
      },
      select: {
        id: true,
        name: true,
        title: true,
        email: true,
        role: true,
        active: true,
        doctorCode: true,
        createdAt: true,
        featureOverrides: true,
      },
    });
    const { featureOverrides: fo, ...rest } = created;
    return {
      ...rest,
      access: mergeFeatureOverrides(created.role, fo),
    };
  }

  async update(auth: AuthContext, id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: tenantWhere(auth.tenantId, { id }),
      select: { role: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    const nextRole = dto.role ?? existing.role;
    const roleChanged = dto.role !== undefined && dto.role !== existing.role;

    let featureOverrides: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined = undefined;
    if (dto.access === null) {
      featureOverrides = Prisma.JsonNull;
    } else if (dto.access !== undefined) {
      const d = diffPartialAccess(nextRole, dto.access as ClinicAccess);
      featureOverrides = d === null ? Prisma.JsonNull : d;
    } else if (roleChanged) {
      featureOverrides = Prisma.JsonNull;
    }

    await this.prisma.user.updateMany({
      where: tenantWhere(auth.tenantId, { id }),
      data: {
        name: dto.name,
        title: dto.title,
        email: dto.email?.toLowerCase(),
        role: dto.role,
        active: dto.active,
        doctorCode:
          dto.role === 'doctor'
            ? (dto.doctorCode ?? undefined)
            : dto.role
              ? null
              : dto.doctorCode,
        ...(featureOverrides !== undefined ? { featureOverrides } : {}),
      },
    });
    const fresh = await this.prisma.user.findFirst({
      where: tenantWhere(auth.tenantId, { id }),
      select: {
        id: true,
        name: true,
        title: true,
        email: true,
        role: true,
        active: true,
        doctorCode: true,
        createdAt: true,
        featureOverrides: true,
      },
    });
    if (!fresh) throw new NotFoundException('User not found');
    const { featureOverrides: fo, ...rest } = fresh;
    return {
      ...rest,
      access: mergeFeatureOverrides(fresh.role, fo),
    };
  }

  async toggleActive(auth: AuthContext, id: string) {
    const user = await this.prisma.user.findFirst({ where: tenantWhere(auth.tenantId, { id }) });
    if (!user) return null;
    return this.update(auth, id, { active: !user.active });
  }
}
