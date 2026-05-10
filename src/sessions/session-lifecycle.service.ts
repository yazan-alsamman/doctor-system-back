import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { AuthContext } from '../common/auth-context';
import { tenantWhere } from '../common/tenant-prisma.helper';
import { assertValidTransition } from '../appointments/appointment-state-machine';
import type { FinalizeSessionDto } from '../appointments/dto/finalize-session.dto';
import { DomainEventsService } from '../common/events/domain-events.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { computePricing } from '../common/billing/pricing.util';
import { pickActiveInvoice } from '../common/billing/appointment-invoice.helper';
import { enforceDiscountPolicy } from '../common/billing/discount-policy.util';
import { money, d0, dMax } from '../common/billing/decimal-money.util';

@Injectable()
export class SessionLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly domainEvents: DomainEventsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async finalizeSession(auth: AuthContext, id: string, dto: FinalizeSessionDto) {
    return this.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findFirst({
        where: tenantWhere(auth.tenantId, { id }),
        include: { service: true, appointmentServices: true, invoices: { orderBy: { createdAt: 'desc' } } },
      });
      if (!appt) throw new NotFoundException('Appointment not found');
      this.assertDoctorAccess(auth, appt.doctorId);

      const targetServiceIds = dto.serviceIds?.length
        ? dto.serviceIds
        : this.getAppointmentServiceIds(appt);
      const services = await tx.service.findMany({
        where: tenantWhere(auth.tenantId, { id: { in: targetServiceIds } }),
      });
      if (services.length !== targetServiceIds.length) throw new NotFoundException('Service not found');
      const primaryService = services[0];

      const nextStatus =
        dto.markCompleted && appt.status !== AppointmentStatus.completed
          ? AppointmentStatus.completed
          : appt.status;
      if (nextStatus !== appt.status) {
        assertValidTransition(appt.status, nextStatus);
      }

      const draftPricing = computePricing({
        servicePrices: services.map((s) => s.price),
        discount: dto.discount ?? appt.discount,
        manualPriceOverride: dto.manualPriceOverride ?? (appt.manualPriceOverride !== null ? appt.manualPriceOverride : undefined),
      });
      const discPol = enforceDiscountPolicy({
        baseTotal: draftPricing.baseTotal,
        discount: draftPricing.discount,
        role: auth.role,
      });

      const pricing = draftPricing;

      const endTime = new Date(
        appt.startTime.getTime() + primaryService.durationMinutes * 60 * 1000,
      );

      await tx.appointment.updateMany({
        where: tenantWhere(auth.tenantId, { id: appt.id }),
        data: {
          serviceId: primaryService.id,
          endTime,
          status: nextStatus,
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
      if (nextStatus === AppointmentStatus.completed && appt.status !== AppointmentStatus.completed) {
        await this.applyCompletionEffectsTx(tx, auth, {
          id: appt.id,
          patientId: appt.patientId,
          doctorId: appt.doctorId,
          serviceId: primaryService.id,
          baseTotal: pricing.baseTotal,
          discount: pricing.discount,
          finalTotal: pricing.finalTotal,
          fallbackServicePrice: money(primaryService.price),
          serviceIds: services.map((s) => s.id),
        });
      }
      await tx.session.upsert({
        where: { appointmentId: appt.id },
        update: {
          status: nextStatus === AppointmentStatus.completed ? 'finalized' : 'in_progress',
          finalizedAt: nextStatus === AppointmentStatus.completed ? new Date() : null,
          consentObtained: !!dto.consentObtained,
          treatmentDetails: dto.treatmentDetails,
          doctorRemarks: dto.doctorRemarks,
          specialConditions: dto.specialConditions,
          finalTotal: pricing.finalTotal,
        },
        create: {
          tenantId: auth.tenantId,
          appointmentId: appt.id,
          patientId: appt.patientId,
          doctorId: appt.doctorId,
          status: nextStatus === AppointmentStatus.completed ? 'finalized' : 'in_progress',
          finalizedAt: nextStatus === AppointmentStatus.completed ? new Date() : null,
          consentObtained: !!dto.consentObtained,
          treatmentDetails: dto.treatmentDetails,
          doctorRemarks: dto.doctorRemarks,
          specialConditions: dto.specialConditions,
          finalTotal: pricing.finalTotal,
        },
      });

      // Keep open invoice aligned when re-finalizing an already-completed visit
      if (appt.status === AppointmentStatus.completed) {
        const openInv = pickActiveInvoice(appt.invoices);
        const pkgAdj = openInv ? money(openInv.packageAdjustment) : d0();
        const expectedFinal = dMax(money(pricing.finalTotal).minus(pkgAdj), d0());
        await this.invoicesService.syncInvoiceWithAppointmentTx(tx, auth, {
          appointmentId: appt.id,
          totalAmount: pricing.baseTotal,
          discount: pricing.discount,
          finalAmount: expectedFinal,
          packageAdjustment: pkgAdj,
        });
      }

      await this.domainEvents.emitTx(tx, {
        tenantId: auth.tenantId,
        aggregateType: 'appointment',
        aggregateId: appt.id,
        eventType: 'SESSION_FINALIZED',
        payload: {
          appointmentId: appt.id,
          actorUserId: auth.userId,
          markCompleted: !!dto.markCompleted,
          serviceIds: services.map((s) => s.id),
          finalTotal: pricing.finalTotal.toString(),
          discountPolicy: discPol.severity,
        },
      });
      await this.auditLog.logTx(tx, {
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        action: 'session.finalize',
        entityType: 'appointment',
        entityId: appt.id,
        metadata: {
          previousStatus: appt.status,
          nextStatus,
          markCompleted: !!dto.markCompleted,
          serviceIds: services.map((s) => s.id),
          finalTotal: pricing.finalTotal.toString(),
          discountPolicy: discPol.severity,
        },
      });
      const updated = await tx.appointment.findFirst({
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
      if (!updated) throw new NotFoundException('Appointment not found');
      return updated;
    });
  }

  async applyCompletionEffectsTx(
    tx: Prisma.TransactionClient,
    auth: AuthContext,
    appt: {
      id: string;
      patientId: string;
      doctorId: string;
      serviceId: string;
      baseTotal: Prisma.Decimal;
      discount: Prisma.Decimal;
      finalTotal: Prisma.Decimal;
      fallbackServicePrice: Prisma.Decimal;
      serviceIds: string[];
    },
  ) {
    const serviceIds = appt.serviceIds.length ? appt.serviceIds : [appt.serviceId];

    const packageCoveredAmount = await this.consumePackageSessionsTx(tx, {
      tenantId: auth.tenantId,
      patientId: appt.patientId,
      serviceIds,
    });

    const baseFinal = appt.finalTotal.gt(d0()) ? appt.finalTotal : appt.fallbackServicePrice;
    const invoiceFinal = dMax(baseFinal.minus(packageCoveredAmount), d0());

    await this.invoicesService.createDraftForAppointmentTx(tx, {
      tenantId: auth.tenantId,
      patientId: appt.patientId,
      appointmentId: appt.id,
      totalAmount: appt.baseTotal.gt(d0()) ? appt.baseTotal : appt.fallbackServicePrice,
      discount: appt.discount,
      finalAmountOverride: invoiceFinal,
      packageAdjustment: packageCoveredAmount,
    });

    await tx.session.upsert({
      where: { appointmentId: appt.id },
      update: { status: 'finalized', finalizedAt: new Date(), finalTotal: appt.finalTotal },
      create: {
        tenantId: auth.tenantId,
        appointmentId: appt.id,
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        status: 'finalized',
        finalizedAt: new Date(),
        finalTotal: appt.finalTotal,
      },
    });

    await this.domainEvents.emitTx(tx, {
      tenantId: auth.tenantId,
      aggregateType: 'appointment',
      aggregateId: appt.id,
      eventType: 'APPOINTMENT_COMPLETION_EFFECTS_APPLIED',
      payload: {
        appointmentId: appt.id,
        patientId: appt.patientId,
        serviceIds,
        packageCoveredAmount: packageCoveredAmount.toString(),
        invoiceFinal: invoiceFinal.toString(),
      },
    });
  }

  getAppointmentServiceIds(appt: {
    serviceId: string;
    appointmentServices?: Array<{ serviceId: string }>;
  }) {
    const ids = appt.appointmentServices?.map((x) => x.serviceId).filter(Boolean) || [];
    return ids.length ? ids : [appt.serviceId];
  }

  private assertDoctorAccess(auth: AuthContext, doctorId: string) {
    if (auth.role !== UserRole.doctor) return;
    if (auth.userId === doctorId) return;
    throw new BadRequestException({
      message: 'Doctor can only modify their own appointments',
      code: 'DOCTOR_SCOPE_VIOLATION',
      status: 400,
    });
  }

  private async consumePackageSessionsTx(
    tx: Prisma.TransactionClient,
    input: { tenantId: string; patientId: string; serviceIds: string[] },
  ): Promise<Prisma.Decimal> {
    const now = new Date();
    let coveredAmount = d0();

    for (const serviceId of Array.from(new Set(input.serviceIds))) {
      const pkg = await tx.patientPackage.findFirst({
        where: {
          tenantId: input.tenantId,
          patientId: input.patientId,
          serviceId,
          deletedAt: null,
          status: 'active',
          remainingSessions: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        select: { id: true, pricePerSession: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!pkg) continue;

      const decremented = await tx.patientPackage.updateMany({
        where: { id: pkg.id, remainingSessions: { gt: 0 } },
        data: { remainingSessions: { decrement: 1 } },
      });
      if (decremented.count === 0) continue;

      const afterDecrement = await tx.patientPackage.findUnique({
        where: { id: pkg.id },
        select: { remainingSessions: true },
      });
      if (afterDecrement?.remainingSessions === 0) {
        await tx.patientPackage.update({
          where: { id: pkg.id },
          data: { status: 'completed' },
        });
      }

      coveredAmount = coveredAmount.plus(money(pkg.pricePerSession));

      await this.domainEvents.emitTx(tx, {
        tenantId: input.tenantId,
        aggregateType: 'patient_package',
        aggregateId: pkg.id,
        eventType: 'PACKAGE_SESSION_CONSUMED',
        payload: {
          patientId: input.patientId,
          serviceId,
          coveredAmount: money(pkg.pricePerSession).toString(),
          remainingSessions: afterDecrement?.remainingSessions ?? 0,
        },
      });
    }

    return coveredAmount;
  }
}
