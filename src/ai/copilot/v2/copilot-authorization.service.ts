import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../../database/prisma.service';
import type { AuthContext } from '../../../common/auth-context';

const UUID = z.string().uuid();

/**
 * Tenant-bound identity checks and doctor-scoped filters for copilot read tools.
 */
@Injectable()
export class CopilotAuthorizationService {
  private readonly logger = new Logger(CopilotAuthorizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Returns effective doctor filter user id, undefined (any doctor), or null if denied / invalid. */
  async resolveDoctorId(
    auth: AuthContext,
    requested?: string,
  ): Promise<string | undefined | null> {
    if (auth.role === UserRole.doctor) {
      return auth.userId;
    }
    const trimmed = requested?.trim();
    if (!trimmed) return undefined;
    if (!UUID.safeParse(trimmed).success) {
      this.logger.debug('reject doctorId: invalid UUID');
      return null;
    }
    const user = await this.prisma.user.findFirst({
      where: {
        id: trimmed,
        tenantId: auth.tenantId,
        role: UserRole.doctor,
        deletedAt: null,
        active: true,
      },
      select: { id: true },
    });
    if (!user) {
      this.logger.debug('reject doctorId: not a doctor in tenant');
      return null;
    }
    return user.id;
  }

  /** Doctors may read clinical context only for patients they have (non-deleted) appointments with. */
  async canReadClinicalPatient(
    auth: AuthContext,
    patientId: string,
  ): Promise<boolean> {
    if (auth.role !== UserRole.doctor) return true;

    const hit = await this.prisma.appointment.findFirst({
      where: {
        tenantId: auth.tenantId,
        patientId,
        doctorId: auth.userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    return Boolean(hit);
  }

  parseUuid(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    if (!s) return null;
    const r = UUID.safeParse(s);
    return r.success ? r.data : null;
  }
}
