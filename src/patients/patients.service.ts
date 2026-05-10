import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationSeverity,
  PatientRecordStatus,
  PatientSex,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { DomainEventsService } from '../common/events/domain-events.service';
import { AuthContext } from '../common/auth-context';
import { tenantWhere } from '../common/tenant-prisma.helper';
import { CreatePatientDto } from './dto/create-patient.dto';
import type { UpdatePatientDto } from './dto/update-patient.dto';
import type { CreatePatientPackageDto } from './dto/create-patient-package.dto';
import {
  buildScheduleForPatients,
  toPatientView,
  type PatientView,
} from './patient-format';
import type { Patient } from '@prisma/client';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly auditLog: AuditLogService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  private normalizeVitals(
    v?: { bp?: string; hr?: number | string; spo2?: number | string } | null,
  ): Prisma.InputJsonValue | undefined {
    if (v === undefined || v === null) return undefined;
    const hr = v.hr !== undefined ? Number(v.hr) : 72;
    const spo2 = v.spo2 !== undefined ? Number(v.spo2) : 98;
    return {
      bp: v.bp ?? '120/80',
      hr: Number.isFinite(hr) ? hr : 72,
      spo2: Number.isFinite(spo2) ? spo2 : 98,
    };
  }

  private mapRecordStatus(s?: 'new' | 'active' | 'inactive'): PatientRecordStatus {
    if (s === 'active') return PatientRecordStatus.active;
    if (s === 'inactive') return PatientRecordStatus.inactive;
    return PatientRecordStatus.new;
  }

  private async toViews(auth: AuthContext, rows: Patient[]): Promise<PatientView[]> {
    if (rows.length === 0) return [];
    const now = new Date();
    const ids = rows.map((p) => p.id);
    const appts = await this.prisma.appointment.findMany({
      where: tenantWhere(auth.tenantId, {
        patientId: { in: ids },
        deletedAt: null,
      }),
      select: {
        patientId: true,
        startTime: true,
        status: true,
      },
    });
    const schedMap = buildScheduleForPatients(ids, appts, now);
    return rows.map((p) =>
      toPatientView(p, schedMap.get(p.id) ?? { last: null, next: null }, now),
    );
  }

  async list(
    auth: AuthContext,
    query?: { q?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, Number(query?.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query?.limit || 50)));
    const search = query?.q?.trim();
    const where: Prisma.PatientWhereInput = tenantWhere(auth.tenantId, {
      deletedAt: null,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    });
    return this.prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.patient.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        tx.patient.count({ where }),
      ]);
      const views = await this.toViews(auth, items);
      return {
        items: views,
        meta: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    });
  }

  async findOne(auth: AuthContext, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: tenantWhere(auth.tenantId, { id, deletedAt: null }),
    });
    if (!patient) throw new NotFoundException('Patient not found');
    const [view] = await this.toViews(auth, [patient]);
    return view;
  }

  listPackages(auth: AuthContext, patientId: string) {
    return this.prisma.patientPackage.findMany({
      where: tenantWhere(auth.tenantId, { patientId }),
      include: { service: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPackage(auth: AuthContext, patientId: string, dto: CreatePatientPackageDto) {
    const patient = await this.prisma.patient.findFirst({
      where: tenantWhere(auth.tenantId, { id: patientId }),
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const service = await this.prisma.service.findFirst({
      where: tenantWhere(auth.tenantId, { id: dto.serviceId }),
      select: { id: true, price: true },
    });
    if (!service) throw new NotFoundException('Service not found');

    // Prevent creating duplicate active packages for the same service
    const existingActive = await this.prisma.patientPackage.findFirst({
      where: {
        tenantId: auth.tenantId,
        patientId,
        serviceId: dto.serviceId,
        status: 'active',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existingActive) {
      throw new ConflictException({
        message: 'Patient already has an active package for this service. Complete or expire the existing package first.',
        code: 'PACKAGE_ALREADY_EXISTS',
        existingPackageId: existingActive.id,
        status: 409,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.patientPackage.create({
        data: {
          tenantId: auth.tenantId,
          patientId,
          serviceId: dto.serviceId,
          totalSessions: dto.totalSessions,
          remainingSessions: dto.totalSessions,
          // Lock price at purchase time so future service price changes don't alter coverage
          pricePerSession: Number(service.price),
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
        include: { service: true },
      });

      await this.domainEvents.emitTx(tx, {
        tenantId: auth.tenantId,
        aggregateType: 'patient_package',
        aggregateId: pkg.id,
        eventType: 'PACKAGE_CREATED',
        payload: {
          patientId,
          serviceId: dto.serviceId,
          totalSessions: dto.totalSessions,
          pricePerSession: Number(service.price),
          expiresAt: dto.expiresAt ?? null,
        },
      });
      await this.auditLog.logTx(tx, {
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        action: 'patient_package.create',
        entityType: 'patient_package',
        entityId: pkg.id,
        metadata: {
          patientId,
          serviceId: dto.serviceId,
          totalSessions: dto.totalSessions,
          pricePerSession: Number(service.price),
          expiresAt: dto.expiresAt ?? null,
        },
      });

      return pkg;
    });
  }

  async create(auth: AuthContext, dto: CreatePatientDto) {
    const existing = await this.prisma.patient.findFirst({
      where: tenantWhere(auth.tenantId, { phone: dto.phone, deletedAt: null }),
    });
    if (existing) {
      throw new ConflictException({
        message: 'A patient with this phone number already exists',
        code: 'PATIENT_PHONE_CONFLICT',
        status: 409,
        existingPatientId: existing.id,
      });
    }

    const dob = dto.dob ? new Date(dto.dob) : null;
    const sex = dto.sex === 'female' ? PatientSex.female : PatientSex.male;
    const vitals =
      dto.vitals === null ? undefined : this.normalizeVitals(dto.vitals ?? undefined);

    const ageYears =
      dob ? null : dto.age === undefined || dto.age === null ? null : dto.age;

    const created = await this.prisma.patient.create({
      data: {
        tenantId: auth.tenantId,
        name: dto.name,
        phone: dto.phone,
        dob,
        notes: dto.notes ?? null,
        sex,
        bloodType: dto.bloodType ?? 'O+',
        recordStatus: this.mapRecordStatus(dto.status),
        ageYears,
        allergies: dto.allergies ?? [],
        medications: dto.medications?.length ? dto.medications : undefined,
        vitals,
      },
    });

    if (dto.quickRegistration) {
      await this.notifications.notifyUsersWithRoles(
        auth.tenantId,
        [UserRole.admin, UserRole.receptionist],
        NotificationSeverity.warning,
        `تسجيل سريع للمريض «${dto.name}» — يُرجى إكمال الملف الطبي لاحقاً.`,
      );
    }

    const [view] = await this.toViews(auth, [created]);
    return view;
  }

  async update(auth: AuthContext, id: string, dto: UpdatePatientDto) {
    const data: Prisma.PatientUncheckedUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.sex !== undefined) {
      data.sex = dto.sex === 'female' ? PatientSex.female : PatientSex.male;
    }
    if (dto.bloodType !== undefined) data.bloodType = dto.bloodType;
    if (dto.status !== undefined) data.recordStatus = this.mapRecordStatus(dto.status);

    if (dto.dob !== undefined) {
      data.dob = dto.dob === null ? null : new Date(dto.dob);
      if (dto.dob !== null) data.ageYears = null;
    }

    if (dto.age !== undefined) {
      if (dto.age === null) {
        data.ageYears = null;
      } else {
        data.ageYears = dto.age;
        if (dto.dob === undefined) data.dob = null;
      }
    }

    if (dto.allergies !== undefined) {
      data.allergies = dto.allergies ?? [];
    }

    if (dto.medications !== undefined) {
      data.medications =
        dto.medications === null || dto.medications.length === 0
          ? Prisma.JsonNull
          : dto.medications;
    }

    if (dto.vitals !== undefined) {
      data.vitals =
        dto.vitals === null ? Prisma.JsonNull : this.normalizeVitals(dto.vitals);
    }

    const result = await this.prisma.patient.updateMany({
      where: tenantWhere(auth.tenantId, { id, deletedAt: null }),
      data,
    });
    if (result.count === 0) throw new NotFoundException('Patient not found');
    return this.findOne(auth, id);
  }

  remove(auth: AuthContext, id: string) {
    return this.prisma.patient.updateMany({
      where: tenantWhere(auth.tenantId, { id }),
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Scheduled job: mark packages whose expiresAt has passed as `expired`.
   * Runs nightly so staff always see accurate package status in the UI.
   * Returns the number of packages updated across all tenants.
   */
  async markExpiredPackages(): Promise<number> {
    const result = await this.prisma.patientPackage.updateMany({
      where: {
        status: 'active',
        deletedAt: null,
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired' },
    });
    return result.count;
  }
}
