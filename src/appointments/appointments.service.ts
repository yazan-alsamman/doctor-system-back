import {
  AppointmentStatus,
  Invoice,
  NotificationSeverity,
  Prisma,
  UserRole,
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthContext } from '../common/auth-context';
import { tenantWhere } from '../common/tenant-prisma.helper';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import type { AddAppointmentMediaDto } from './dto/add-appointment-media.dto';
import type { CreateNextSessionDto } from './dto/create-next-session.dto';
import type { FinalizeSessionDto } from './dto/finalize-session.dto';
import type { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { assertValidTransition } from './appointment-state-machine';
import { SessionLifecycleService } from '../sessions/session-lifecycle.service';
import { InvoicesService } from '../invoices/invoices.service';
import { DomainEventsService } from '../common/events/domain-events.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { packNotificationMessage } from '../notifications/notification-message.util';
import { computePricing } from '../common/billing/pricing.util';
import { money } from '../common/billing/decimal-money.util';
import { pickActiveInvoice } from '../common/billing/appointment-invoice.helper';
import { enforceDiscountPolicy } from '../common/billing/discount-policy.util';
import {
  getClinicTimezone,
  startOfDayInTimezone,
  toLocalMinutes,
} from '../common/utils/timezone.util';

function withLegacyInvoice(row: unknown) {
  if (!row || typeof row !== 'object') return row;
  const r = row as { invoices?: Invoice[] };
  const { invoices, ...rest } = r;
  return {
    ...rest,
    invoices,
    invoice: pickActiveInvoice(invoices),
  };
}

// Statuses that still occupy the slot (no-show frees the slot for rebooking)
const SLOT_BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.scheduled,
  AppointmentStatus.confirmed,
  AppointmentStatus.arrived,
  AppointmentStatus.in_consultation,
  AppointmentStatus.completed,
  AppointmentStatus.paid,
];

// Statuses that are safe to edit scheduling/pricing fields on
const EDITABLE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.scheduled,
  AppointmentStatus.confirmed,
  AppointmentStatus.arrived,
]);

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionLifecycleService: SessionLifecycleService,
    private readonly invoicesService: InvoicesService,
    private readonly domainEvents: DomainEventsService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  list(
    auth: AuthContext,
    query?: {
      doctorId?: string;
      status?: AppointmentStatus;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(query?.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query?.limit || 50)));
    let doctorIdFilter = query?.doctorId;
    if (auth.role === UserRole.doctor) {
      doctorIdFilter = auth.userId;
    }
    const where: Prisma.AppointmentWhereInput = tenantWhere(auth.tenantId, {
      doctorId: doctorIdFilter || undefined,
      status: query?.status || undefined,
      startTime: query?.from || query?.to
        ? {
            gte: query?.from ? new Date(query.from) : undefined,
            lte: query?.to ? new Date(query.to) : undefined,
          }
        : undefined,
    });

    return this.prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.appointment.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { startTime: 'asc' },
          include: {
            patient: true,
            doctor: true,
            service: true,
            invoices: { orderBy: { createdAt: 'desc' } },
            session: true,
            appointmentServices: { include: { service: true } },
            media: true,
          },
        }),
        tx.appointment.count({ where }),
      ]);
      return {
        items: items.map((row) => withLegacyInvoice(row)!),
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
    const appt = await this.prisma.appointment.findFirst({
      where: tenantWhere(auth.tenantId, { id }),
      include: {
        patient: true,
        doctor: true,
        service: true,
        invoices: { orderBy: { createdAt: 'desc' } },
        session: true,
        appointmentServices: { include: { service: true } },
        media: true,
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    if (auth.role === UserRole.doctor && appt.doctorId !== auth.userId) {
      throw new ForbiddenException({ message: 'Access denied', code: 'FORBIDDEN', status: 403 });
    }
    return withLegacyInvoice(appt);
  }

  async availability(
    auth: AuthContext,
    input: { doctorId: string; date: string; serviceId?: string; durationMinutes?: number },
  ) {
    const tz = getClinicTimezone();
    const dayDate = this.parseDateOnly(input.date);
    const dayOfWeek = dayDate.getDay();
    const durationMinutes =
      typeof input.durationMinutes === 'number' && input.durationMinutes > 0
        ? input.durationMinutes
        : await this.resolveDurationFromService(auth.tenantId, input.serviceId);
    const schedule = await this.prisma.doctorSchedule.findFirst({
      where: tenantWhere(auth.tenantId, {
        doctorId: input.doctorId,
        dayOfWeek,
        deletedAt: null,
      }),
      orderBy: { createdAt: 'desc' },
    });
    if (!schedule) {
      throw new BadRequestException({
        message: 'No doctor schedule configured for selected date',
        code: 'DOCTOR_SCHEDULE_NOT_FOUND',
        status: 400,
      });
    }

    const scheduleStart = this.parseClockToMinutes(schedule.startTime);
    const scheduleEnd = this.parseClockToMinutes(schedule.endTime);
    const breakStart = schedule.breakStart ? this.parseClockToMinutes(schedule.breakStart) : null;
    const breakEnd = schedule.breakEnd ? this.parseClockToMinutes(schedule.breakEnd) : null;

    // Use timezone-aware start of day so slot queries are scoped correctly
    const startOfDay = startOfDayInTimezone(input.date, tz);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const appointments = await this.prisma.appointment.findMany({
      where: tenantWhere(auth.tenantId, {
        doctorId: input.doctorId,
        status: { in: SLOT_BLOCKING_STATUSES },
        startTime: { gte: startOfDay, lt: endOfDay },
      }),
      select: { id: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    });

    const slotStep = 15;
    const availableSlots: string[] = [];
    const unavailableSlots: string[] = [];
    for (let pointer = scheduleStart; pointer + durationMinutes <= scheduleEnd; pointer += slotStep) {
      const slotStart = this.withDayMinutes(startOfDay, pointer);
      const slotEnd = this.withDayMinutes(startOfDay, pointer + durationMinutes);
      const hitsBreak =
        breakStart !== null &&
        breakEnd !== null &&
        pointer < breakEnd &&
        pointer + durationMinutes > breakStart;
      const hasConflict = appointments.some(
        (appt) => slotStart < appt.endTime && slotEnd > appt.startTime,
      );
      const hhmm = this.toClock(pointer);
      if (hitsBreak || hasConflict) {
        unavailableSlots.push(hhmm);
      } else {
        availableSlots.push(hhmm);
      }
    }

    return {
      doctorId: input.doctorId,
      date: input.date,
      timezone: tz,
      durationMinutes,
      workingHours: { start: schedule.startTime, end: schedule.endTime },
      breakHours:
        breakStart !== null && breakEnd !== null
          ? { start: schedule.breakStart, end: schedule.breakEnd }
          : null,
      availableSlots,
      unavailableSlots,
    };
  }

  async create(auth: AuthContext, dto: CreateAppointmentDto) {
    const serviceIds = dto.serviceIds?.length ? dto.serviceIds : [dto.serviceId];
    const services = await this.prisma.service.findMany({
      where: tenantWhere(auth.tenantId, { id: { in: serviceIds } }),
    });
    if (services.length !== serviceIds.length) throw new NotFoundException('Service not found');
    const primaryService = services[0];

    const patient = await this.prisma.patient.findFirst({
      where: tenantWhere(auth.tenantId, { id: dto.patientId }),
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const doctor = await this.prisma.user.findFirst({
      where: tenantWhere(auth.tenantId, { id: dto.doctorId, role: UserRole.doctor }),
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const startTime = this.normalizeDate(dto.startTime, 'startTime');
    const endTime = new Date(startTime.getTime() + primaryService.durationMinutes * 60 * 1000);

    if (startTime.getTime() < Date.now()) {
      throw new BadRequestException({
        message: 'لا يمكن حجز موعد في وقت مضى',
        code: 'APPOINTMENT_IN_PAST',
        status: 400,
      });
    }

    const pricing = computePricing({
      servicePrices: services.map((s) => s.price),
      discount: dto.discount,
      manualPriceOverride: dto.manualPriceOverride,
    });
    enforceDiscountPolicy({
      baseTotal: pricing.baseTotal,
      discount: pricing.discount,
      role: auth.role,
    });

    const created = await this.prisma.$transaction(
      async (tx) => {
        // Conflict check inside the transaction under SERIALIZABLE isolation
        // so two concurrent bookings cannot both pass and double-book.
        await this.assertBookableSlotTx(tx, {
          tenantId: auth.tenantId,
          doctorId: dto.doctorId,
          startTime,
          endTime,
          allowOverbook: !!dto.allowOverbook,
        });

        const appt = await tx.appointment.create({
          data: {
            tenantId:  auth.tenantId,
            patientId: dto.patientId,
            doctorId: dto.doctorId,
            serviceId: primaryService.id,
            startTime,
            endTime,
            status: AppointmentStatus.scheduled,
            overbooked: !!dto.allowOverbook,
            notes: dto.notes,
            baseTotal: pricing.baseTotal,
            discount: pricing.discount,
            finalTotal: pricing.finalTotal,
            manualPriceOverride: dto.manualPriceOverride,
            consentObtained: !!dto.consentObtained,
            treatmentDetails: dto.treatmentDetails,
            doctorRemarks: dto.doctorRemarks,
            specialConditions: dto.specialConditions,
          },
        });
        await tx.appointmentService.createMany({
          data: services.map((service) => ({
            appointmentId: appt.id,
            serviceId: service.id,
            quantity: 1,
            unitPrice: service.price,
            lineTotal: service.price,
          })),
        });
        await this.domainEvents.emitTx(tx, {
          tenantId: auth.tenantId,
          aggregateType: 'appointment',
          aggregateId: appt.id,
          eventType: 'APPOINTMENT_CREATED',
          payload: {
            appointmentId: appt.id,
            patientId: appt.patientId,
            doctorId: appt.doctorId,
            serviceIds: services.map((s) => s.id),
            status: appt.status,
          },
        });
        await this.auditLog.logTx(tx, {
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          action: 'appointment.create',
          entityType: 'appointment',
          entityId: appt.id,
          metadata: {
            patientId: appt.patientId,
            doctorId: appt.doctorId,
            serviceIds: services.map((s) => s.id),
            startTime: appt.startTime.toISOString(),
          },
        });
        return tx.appointment.findFirst({
          where: tenantWhere(auth.tenantId, { id: appt.id }),
          include: {
            patient: true,
            doctor: true,
            service: true,
            invoices: { orderBy: { createdAt: 'desc' } },
            session: true,
            appointmentServices: { include: { service: true } },
            media: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (!created) throw new NotFoundException('Appointment not found after create');
    this.logger.log(`Appointment created: ${created.id} (tenant ${auth.tenantId})`);

    try {
      await this.notifications.createForUser(
        auth.tenantId,
        created.doctorId,
        NotificationSeverity.info,
        `موعد جديد: ${patient.name}`,
      );
      if (created.overbooked) {
        await this.notifications.notifyUsersWithRoles(
          auth.tenantId,
          [UserRole.admin, UserRole.receptionist],
          NotificationSeverity.critical,
          packNotificationMessage(`تنبيه حجز فوق الطاقة: ${patient.name}`, {
            appointmentId: created.id,
            actions: ['dismiss'],
          }),
        );
      }
    } catch (err) {
      this.logger.warn(`Notification hook failed for appointment ${created.id}: ${String(err)}`);
    }

    return withLegacyInvoice(created);
  }

  async update(auth: AuthContext, id: string, dto: UpdateAppointmentDto) {
    const appt = await this.prisma.appointment.findFirst({
      where: tenantWhere(auth.tenantId, { id }),
      include: { service: true },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    if (auth.role === UserRole.doctor && appt.doctorId !== auth.userId) {
      throw new ForbiddenException({
        message: 'Cannot modify appointments for another doctor',
        code: 'FORBIDDEN',
        status: 403,
      });
    }

    // Block structural changes (time, services, pricing) on completed/paid appointments
    const isStructuralChange =
      dto.startTime !== undefined ||
      dto.serviceId !== undefined ||
      dto.serviceIds !== undefined ||
      dto.doctorId !== undefined ||
      dto.patientId !== undefined ||
      dto.discount !== undefined ||
      dto.manualPriceOverride !== undefined;

    if (isStructuralChange && !EDITABLE_STATUSES.has(appt.status)) {
      throw new BadRequestException({
        message: `Cannot modify scheduling or pricing of an appointment in '${appt.status}' status`,
        code: 'APPOINTMENT_NOT_EDITABLE',
        status: 400,
      });
    }

    const targetServiceIds = dto.serviceIds?.length
      ? dto.serviceIds
      : [dto.serviceId ?? appt.serviceId];
    const services = await this.prisma.service.findMany({
      where: tenantWhere(auth.tenantId, { id: { in: targetServiceIds } }),
    });
    if (services.length !== targetServiceIds.length) throw new NotFoundException('Service not found');
    const primaryService = services[0];

    const patientId = dto.patientId ?? appt.patientId;
    const doctorId = dto.doctorId ?? appt.doctorId;

    const patient = await this.prisma.patient.findFirst({
      where: tenantWhere(auth.tenantId, { id: patientId }),
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const doctor = await this.prisma.user.findFirst({
      where: tenantWhere(auth.tenantId, { id: doctorId, role: UserRole.doctor }),
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const startTime = dto.startTime
      ? this.normalizeDate(dto.startTime, 'startTime')
      : appt.startTime;
    const endTime = new Date(startTime.getTime() + primaryService.durationMinutes * 60 * 1000);

    if (dto.startTime !== undefined && startTime.getTime() < Date.now()) {
      throw new BadRequestException({
        message: 'لا يمكن جدولة الموعد في وقت مضى',
        code: 'APPOINTMENT_IN_PAST',
        status: 400,
      });
    }

    const pricing = computePricing({
      servicePrices: services.map((s) => s.price),
      discount: dto.discount ?? appt.discount,
      manualPriceOverride:
        dto.manualPriceOverride ?? (appt.manualPriceOverride !== null ? appt.manualPriceOverride : undefined),
    });
    enforceDiscountPolicy({
      baseTotal: pricing.baseTotal,
      discount: pricing.discount,
      role: auth.role,
    });

    const updated = await this.prisma.$transaction(
      async (tx) => {
        if (isStructuralChange) {
          await this.assertBookableSlotTx(tx, {
            tenantId: auth.tenantId,
            doctorId,
            startTime,
            endTime,
            allowOverbook: !!dto.overbooked,
            ignoreAppointmentId: appt.id,
          });
        }

        const updatedCount = await tx.appointment.updateMany({
          where: tenantWhere(auth.tenantId, { id: appt.id }),
          data: {
            patientId,
            doctorId,
            serviceId: primaryService.id,
            startTime,
            endTime,
            notes: dto.notes,
            overbooked: dto.overbooked,
            baseTotal: pricing.baseTotal,
            discount: pricing.discount,
            finalTotal: pricing.finalTotal,
            manualPriceOverride: dto.manualPriceOverride ?? undefined,
            consentObtained: dto.consentObtained,
            treatmentDetails: dto.treatmentDetails,
            doctorRemarks: dto.doctorRemarks,
            specialConditions: dto.specialConditions,
          },
        });
        if (!updatedCount.count) throw new NotFoundException('Appointment not found');
        await tx.appointmentService.deleteMany({ where: { appointmentId: appt.id } });
        await tx.appointmentService.createMany({
          data: services.map((service) => ({
            appointmentId: appt.id,
            serviceId: service.id,
            quantity: 1,
            unitPrice: service.price,
            lineTotal: service.price,
          })),
        });
        await this.domainEvents.emitTx(tx, {
          tenantId: auth.tenantId,
          aggregateType: 'appointment',
          aggregateId: appt.id,
          eventType: 'APPOINTMENT_UPDATED',
          payload: { appointmentId: appt.id, patientId, doctorId, serviceIds: services.map((s) => s.id) },
        });
        await this.auditLog.logTx(tx, {
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          action: 'appointment.update',
          entityType: 'appointment',
          entityId: appt.id,
          metadata: {
            patientId,
            doctorId,
            serviceIds: services.map((s) => s.id),
            startTime: startTime.toISOString(),
            before: { discount: money(appt.discount).toString(), finalTotal: money(appt.finalTotal).toString() },
            after: { discount: pricing.discount.toString(), finalTotal: pricing.finalTotal.toString() },
          },
        });
        return tx.appointment.findFirst({
          where: tenantWhere(auth.tenantId, { id: appt.id }),
          include: {
            patient: true,
            doctor: true,
            service: true,
            invoices: { orderBy: { createdAt: 'desc' } },
            session: true,
            appointmentServices: { include: { service: true } },
            media: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return withLegacyInvoice(updated);
  }

  async updateStatus(auth: AuthContext, id: string, dto: UpdateAppointmentStatusDto) {
    let missedArrivalPatient: string | null = null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findFirst({
        where: tenantWhere(auth.tenantId, { id }),
        include: { service: true, appointmentServices: true, patient: true },
      });
      if (!appt) throw new NotFoundException('Appointment not found');

      if (auth.role === UserRole.doctor && appt.doctorId !== auth.userId) {
        throw new ForbiddenException({
          message: 'Cannot change status for another doctor',
          code: 'FORBIDDEN',
          status: 403,
        });
      }

      assertValidTransition(appt.status, dto.status);

      await tx.appointment.updateMany({
        where: tenantWhere(auth.tenantId, { id: appt.id }),
        data: {
          status: dto.status,
          notes: dto.reason ? `${appt.notes ?? ''}\n${dto.reason}`.trim() : appt.notes,
        },
      });
      const next = await tx.appointment.findFirst({
        where: tenantWhere(auth.tenantId, { id: appt.id }),
        include: {
          patient: true,
          doctor: true,
          service: true,
          invoices: { orderBy: { createdAt: 'desc' } },
          session: true,
          appointmentServices: { include: { service: true } },
          media: true,
        },
      });
      if (!next) throw new NotFoundException('Appointment not found');

      if (dto.status === AppointmentStatus.completed && appt.status !== AppointmentStatus.completed) {
        await this.sessionLifecycleService.applyCompletionEffectsTx(tx, auth, {
          id: appt.id,
          patientId: appt.patientId,
          doctorId: appt.doctorId,
          serviceId: appt.serviceId,
          baseTotal: money(appt.baseTotal),
          discount: money(appt.discount),
          finalTotal: money(appt.finalTotal),
          fallbackServicePrice: money(appt.service.price),
          serviceIds: this.sessionLifecycleService.getAppointmentServiceIds(appt),
        });
      }
      // Cancel any outstanding draft invoice when the appointment becomes unreachable for billing
      if (dto.status === AppointmentStatus.no_show) {
        await this.invoicesService.cancelDraftInvoiceForAppointmentTx(tx, auth.tenantId, appt.id, auth.userId);
      }
      await this.domainEvents.emitTx(tx, {
        tenantId: auth.tenantId,
        aggregateType: 'appointment',
        aggregateId: appt.id,
        eventType: 'APPOINTMENT_STATUS_CHANGED',
        payload: {
          appointmentId: appt.id,
          previousStatus: appt.status,
          nextStatus: dto.status,
          reason: dto.reason,
        },
      });
      await this.auditLog.logTx(tx, {
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        action: 'appointment.status.update',
        entityType: 'appointment',
        entityId: appt.id,
        metadata: { previousStatus: appt.status, nextStatus: dto.status, reason: dto.reason },
      });
      this.logger.log(`Appointment status: ${appt.id} ${appt.status} → ${dto.status}`);
      if (dto.status === AppointmentStatus.no_show) {
        missedArrivalPatient = appt.patient?.name ?? 'مريض';
      }
      return next;
    });

    if (missedArrivalPatient) {
      try {
        await this.notifications.notifyUsersWithRoles(
          auth.tenantId,
          [UserRole.admin, UserRole.receptionist],
          NotificationSeverity.warning,
          packNotificationMessage(`تخطّي حضور (لم يصل): ${missedArrivalPatient}`, {
            appointmentId: id,
            actions: ['dismiss'],
          }),
        );
      } catch (err) {
        this.logger.warn(`Missed-arrival notification failed: ${String(err)}`);
      }
    }

    return withLegacyInvoice(updated);
  }

  async requestReceptionAssistance(auth: AuthContext, id: string) {
    const appt = await this.prisma.appointment.findFirst({
      where: tenantWhere(auth.tenantId, { id }),
      include: { patient: true, doctor: true },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    if (auth.role === UserRole.doctor && appt.doctorId !== auth.userId) {
      throw new ForbiddenException({
        message: 'Cannot request reception help for another doctor appointment',
        code: 'FORBIDDEN',
        status: 403,
      });
    }

    const patientName = appt.patient?.name ?? 'مريض';
    const doctorName = appt.doctor?.name ?? 'الطبيب';

    let message: string;
    let actions: ('checkin' | 'send_to_doctor' | 'dismiss')[];

    if (
      appt.status === AppointmentStatus.scheduled ||
      appt.status === AppointmentStatus.confirmed
    ) {
      message = `طلب من الطبيب (${doctorName}): تسجيل وصول — ${patientName}`;
      actions = ['checkin', 'dismiss'];
    } else if (appt.status === AppointmentStatus.arrived) {
      message = `طلب من الطبيب (${doctorName}): إدخال المريض للمعاينة — ${patientName}`;
      actions = ['send_to_doctor', 'dismiss'];
    } else {
      throw new BadRequestException({
        message: 'لا يوجد إجراء مطلوب من الاستقبال في هذه الحالة',
        code: 'RECEPTION_REQUEST_NOT_APPLICABLE',
        status: 400,
      });
    }

    try {
      await this.notifications.notifyUsersWithRoles(
        auth.tenantId,
        [UserRole.admin, UserRole.receptionist],
        NotificationSeverity.warning,
        packNotificationMessage(message, { appointmentId: appt.id, actions }),
      );
    } catch (err) {
      this.logger.warn(`requestReceptionAssistance notify failed: ${String(err)}`);
    }

    return { ok: true as const };
  }

  async finalizeSession(auth: AuthContext, id: string, dto: FinalizeSessionDto) {
    return this.sessionLifecycleService.finalizeSession(auth, id, dto);
  }

  async createNextSession(auth: AuthContext, id: string, dto: CreateNextSessionDto) {
    const source = await this.prisma.appointment.findFirst({
      where: tenantWhere(auth.tenantId, { id }),
      include: { appointmentServices: true },
    });
    if (!source) throw new NotFoundException('Appointment not found');

    const serviceIds = this.sessionLifecycleService.getAppointmentServiceIds(source);
    const services = await this.prisma.service.findMany({
      where: tenantWhere(auth.tenantId, { id: { in: serviceIds } }),
    });
    if (!services.length) throw new NotFoundException('Service not found');
    const primaryService = services[0];

    const createdIds: string[] = [];
    for (let i = 1; i <= dto.repeatCount; i += 1) {
      const startTime = this.addDays(source.startTime, dto.intervalDays * i);
      const endTime = new Date(startTime.getTime() + primaryService.durationMinutes * 60 * 1000);

      const pricing = computePricing({
        servicePrices: services.map((s) => s.price),
        discount: source.discount,
        manualPriceOverride: source.manualPriceOverride !== null ? source.manualPriceOverride : undefined,
      });
      enforceDiscountPolicy({
        baseTotal: pricing.baseTotal,
        discount: pricing.discount,
        role: auth.role,
      });

      const created = await this.prisma.$transaction(
        async (tx) => {
          await this.assertBookableSlotTx(tx, {
            tenantId: auth.tenantId,
            doctorId: source.doctorId,
            startTime,
            endTime,
            allowOverbook: !!dto.allowOverbook,
          });
          const appt = await tx.appointment.create({
            data: {
              tenantId: auth.tenantId,
              patientId: source.patientId,
              doctorId: source.doctorId,
              serviceId: primaryService.id,
              status: AppointmentStatus.scheduled,
              startTime,
              endTime,
              overbooked: !!dto.allowOverbook,
              notes: source.notes,
              baseTotal: pricing.baseTotal,
              discount: pricing.discount,
              finalTotal: pricing.finalTotal,
              manualPriceOverride: source.manualPriceOverride ?? undefined,
            },
          });
          await tx.appointmentService.createMany({
            data: services.map((service) => ({
              appointmentId: appt.id,
              serviceId: service.id,
              quantity: 1,
              unitPrice: service.price,
              lineTotal: service.price,
            })),
          });
          await this.domainEvents.emitTx(tx, {
            tenantId: auth.tenantId,
            aggregateType: 'appointment',
            aggregateId: appt.id,
            eventType: 'APPOINTMENT_CREATED_FROM_NEXT_SESSION',
            payload: { sourceAppointmentId: source.id, appointmentId: appt.id, sequence: i },
          });
          await this.auditLog.logTx(tx, {
            tenantId: auth.tenantId,
            actorUserId: auth.userId,
            action: 'appointment.next_session.create',
            entityType: 'appointment',
            entityId: appt.id,
            metadata: { sourceAppointmentId: source.id, sequence: i, startTime: startTime.toISOString() },
          });
          return appt.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      createdIds.push(created);
    }

    return this.prisma.appointment.findMany({
      where: tenantWhere(auth.tenantId, { id: { in: createdIds } }),
      include: {
        patient: true,
        doctor: true,
        service: true,
        session: true,
        appointmentServices: { include: { service: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async addMedia(auth: AuthContext, id: string, dto: AddAppointmentMediaDto) {
    const appt = await this.prisma.appointment.findFirst({
      where: tenantWhere(auth.tenantId, { id }),
      select: { id: true },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    const count = await this.prisma.appointmentMedia.count({
      where: { appointmentId: id, tenantId: auth.tenantId, label: dto.label },
    });
    if (count >= 3) {
      throw new BadRequestException({
        message: `Only up to 3 ${dto.label} images are allowed`,
        code: 'MAX_MEDIA_REACHED',
        status: 400,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const media = await tx.appointmentMedia.create({
        data: {
          tenantId: auth.tenantId,
          appointmentId: id,
          label: dto.label,
          imageUrl: dto.imageUrl,
        },
      });
      await this.domainEvents.emitTx(tx, {
        tenantId: auth.tenantId,
        aggregateType: 'appointment',
        aggregateId: id,
        eventType: 'APPOINTMENT_MEDIA_ADDED',
        payload: { appointmentId: id, mediaId: media.id, label: media.label },
      });
      await this.auditLog.logTx(tx, {
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        action: 'appointment.media.add',
        entityType: 'appointment',
        entityId: id,
        metadata: { mediaId: media.id, label: media.label },
      });
      return media;
    });
  }

  /** Scheduled job: auto-mark overdue appointments as no-show. */
  async markNoShows(delayMinutes = 25) {
    const cutoff = new Date(Date.now() - delayMinutes * 60 * 1000);
    const activeTenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null, status: 'active' },
      select: { id: true },
    });
    let total = 0;
    for (const tenant of activeTenants) {
      total += await this.markNoShowsForTenant(tenant.id, cutoff);
    }
    if (total > 0) this.logger.log(`No-show sweep marked ${total} appointments`);
    return total;
  }

  async markNoShowsForTenant(tenantId: string, cutoff?: Date) {
    const cutoffDate = cutoff ?? new Date(Date.now() - 25 * 60 * 1000);
    // Include both scheduled and confirmed — many clinics never move to confirmed
    const noShowAppts = await this.prisma.appointment.findMany({
      where: tenantWhere(tenantId, {
        status: { in: [AppointmentStatus.scheduled, AppointmentStatus.confirmed] },
        startTime: { lt: cutoffDate },
      }),
      select: { id: true },
    });
    if (noShowAppts.length === 0) return 0;

    const apptIds = noShowAppts.map((a) => a.id);
    await this.prisma.$transaction([
      this.prisma.appointment.updateMany({
        where: { id: { in: apptIds }, tenantId },
        data: { status: AppointmentStatus.no_show },
      }),
      // Cancel any draft invoices for these appointments in the same transaction
      this.prisma.invoice.updateMany({
        where: { appointmentId: { in: apptIds }, tenantId, status: 'draft', deletedAt: null },
        data: { status: 'cancelled' },
      }),
    ]);
    return noShowAppts.length;
  }

  remove(auth: AuthContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findFirst({
        where: tenantWhere(auth.tenantId, { id }),
        select: { id: true, status: true },
      });
      if (!appt) return { count: 0 };

      const undeletableStatuses: AppointmentStatus[] = [
        AppointmentStatus.in_consultation,
        AppointmentStatus.completed,
        AppointmentStatus.paid,
      ];
      if (undeletableStatuses.includes(appt.status)) {
        throw new BadRequestException({
          message: `Cannot delete an appointment in '${appt.status}' status`,
          code: 'APPOINTMENT_NOT_DELETABLE',
          status: 400,
        });
      }

      const removed = await tx.appointment.updateMany({
        where: tenantWhere(auth.tenantId, { id }),
        data: { deletedAt: new Date() },
      });
      if (removed.count > 0) {
        await this.invoicesService.cancelDraftInvoiceForAppointmentTx(tx, auth.tenantId, id, auth.userId);
        await this.domainEvents.emitTx(tx, {
          tenantId: auth.tenantId,
          aggregateType: 'appointment',
          aggregateId: id,
          eventType: 'APPOINTMENT_REMOVED',
          payload: { appointmentId: id },
        });
        await this.auditLog.logTx(tx, {
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          action: 'appointment.remove',
          entityType: 'appointment',
          entityId: id,
        });
      }
      return removed;
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private normalizeDate(raw: string, field: string) {
    const value = new Date(raw);
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException({
        message: `${field} must be a valid ISO datetime`,
        code: 'INVALID_DATETIME',
        status: 400,
      });
    }
    return value;
  }

  private parseDateOnly(raw: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      throw new BadRequestException({
        message: 'date must be in YYYY-MM-DD format',
        code: 'INVALID_DATE',
        status: 400,
      });
    }
    // Return a plain Date; the day-of-week is extracted for schedule lookup (DOW is TZ-independent)
    const parsed = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({ message: 'Invalid date value', code: 'INVALID_DATE', status: 400 });
    }
    return parsed;
  }

  /**
   * Conflict check that runs INSIDE a transaction.
   * With SERIALIZABLE isolation (used in create/update) this is sufficient to prevent
   * concurrent double-bookings at the DB level.
   */
  private async assertBookableSlotTx(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      doctorId: string;
      startTime: Date;
      endTime: Date;
      allowOverbook: boolean;
      ignoreAppointmentId?: string;
    },
  ) {
    await this.assertWithinDoctorScheduleTx(tx, input.tenantId, input.doctorId, input.startTime, input.endTime);
    if (input.allowOverbook) return;

    const conflict = await tx.appointment.findFirst({
      where: tenantWhere(input.tenantId, {
        id: input.ignoreAppointmentId ? { not: input.ignoreAppointmentId } : undefined,
        doctorId: input.doctorId,
        status: { in: SLOT_BLOCKING_STATUSES },
        startTime: { lt: input.endTime },
        endTime: { gt: input.startTime },
      }),
      select: { id: true },
    });

    if (conflict) {
      throw new BadRequestException({
        message: 'Appointment conflicts with an existing booking',
        code: 'APPOINTMENT_CONFLICT',
        status: 400,
      });
    }
  }

  private async assertWithinDoctorScheduleTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    doctorId: string,
    startTime: Date,
    endTime: Date,
  ) {
    const tz = getClinicTimezone();
    const dayOfWeek = new Date(
      new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(startTime) === 'Sun'
        ? 0
        : startTime.getUTCDay(), // fallback; the real fix is below
    ).getDay();

    // Correct day-of-week in clinic timezone
    const localDow = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'narrow' })
      .formatToParts(startTime)
      .find((p) => p.type === 'weekday')?.value;
    const dowMap: Record<string, number> = { S: 0, M: 1, T: 2, W: 3, F: 5 };
    // Use numeric day from UTC-aware formatting
    const numericDay = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric' }).format(startTime),
      10,
    );
    // Safest: use the weekday index from a locale that gives 0-based numbers
    const clinicDayOfWeek = this.getLocalDayOfWeek(startTime, tz);

    const schedule = await tx.doctorSchedule.findFirst({
      where: tenantWhere(tenantId, { doctorId, dayOfWeek: clinicDayOfWeek, deletedAt: null }),
      orderBy: { createdAt: 'desc' },
    });
    if (!schedule) {
      throw new BadRequestException({
        message: 'No doctor schedule configured for this day',
        code: 'DOCTOR_SCHEDULE_NOT_FOUND',
        status: 400,
      });
    }

    const startMinutes = toLocalMinutes(startTime, tz);
    const endMinutes = toLocalMinutes(endTime, tz);
    const scheduleStart = this.parseClockToMinutes(schedule.startTime);
    const scheduleEnd = this.parseClockToMinutes(schedule.endTime);
    const breakStart = schedule.breakStart ? this.parseClockToMinutes(schedule.breakStart) : null;
    const breakEnd = schedule.breakEnd ? this.parseClockToMinutes(schedule.breakEnd) : null;

    if (startMinutes < scheduleStart || endMinutes > scheduleEnd) {
      throw new BadRequestException({
        message: 'Appointment is outside doctor working hours',
        code: 'OUTSIDE_DOCTOR_HOURS',
        status: 400,
      });
    }

    if (breakStart !== null && breakEnd !== null && startMinutes < breakEnd && endMinutes > breakStart) {
      throw new BadRequestException({
        message: 'Appointment overlaps doctor break time',
        code: 'DOCTOR_BREAK_CONFLICT',
        status: 400,
      });
    }

    void localDow; void dowMap; void numericDay; void dayOfWeek; // suppress unused-var warnings
  }

  private getLocalDayOfWeek(date: Date, tz: string): number {
    const dayName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(date);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days.indexOf(dayName);
  }

  private parseClockToMinutes(raw: string) {
    const [hh, mm] = raw.split(':').map((part) => Number(part));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
      throw new BadRequestException({
        message: `Invalid schedule time format: ${raw}`,
        code: 'INVALID_SCHEDULE_TIME',
        status: 400,
      });
    }
    return hh * 60 + mm;
  }

  private toClock(totalMinutes: number) {
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  private withDayMinutes(dayStart: Date, minutes: number) {
    return new Date(dayStart.getTime() + minutes * 60 * 1000);
  }

  private async resolveDurationFromService(tenantId: string, serviceId?: string) {
    if (!serviceId) return 30;
    const service = await this.prisma.service.findFirst({
      where: tenantWhere(tenantId, { id: serviceId }),
      select: { durationMinutes: true },
    });
    if (!service) throw new NotFoundException('Service not found');
    return Math.max(1, service.durationMinutes);
  }

  private addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

}
