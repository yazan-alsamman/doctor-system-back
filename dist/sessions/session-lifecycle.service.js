"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionLifecycleService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../database/prisma.service");
const invoices_service_1 = require("../invoices/invoices.service");
const tenant_prisma_helper_1 = require("../common/tenant-prisma.helper");
const appointment_state_machine_1 = require("../appointments/appointment-state-machine");
const domain_events_service_1 = require("../common/events/domain-events.service");
const audit_log_service_1 = require("../common/audit/audit-log.service");
const pricing_util_1 = require("../common/billing/pricing.util");
const appointment_invoice_helper_1 = require("../common/billing/appointment-invoice.helper");
const discount_policy_util_1 = require("../common/billing/discount-policy.util");
const decimal_money_util_1 = require("../common/billing/decimal-money.util");
let SessionLifecycleService = class SessionLifecycleService {
    prisma;
    invoicesService;
    domainEvents;
    auditLog;
    constructor(prisma, invoicesService, domainEvents, auditLog) {
        this.prisma = prisma;
        this.invoicesService = invoicesService;
        this.domainEvents = domainEvents;
        this.auditLog = auditLog;
    }
    async finalizeSession(auth, id, dto) {
        return this.prisma.$transaction(async (tx) => {
            const appt = await tx.appointment.findFirst({
                where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id }),
                include: { service: true, appointmentServices: true, invoices: { orderBy: { createdAt: 'desc' } } },
            });
            if (!appt)
                throw new common_1.NotFoundException('Appointment not found');
            this.assertDoctorAccess(auth, appt.doctorId);
            const targetServiceIds = dto.serviceIds?.length
                ? dto.serviceIds
                : this.getAppointmentServiceIds(appt);
            const services = await tx.service.findMany({
                where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: { in: targetServiceIds } }),
            });
            if (services.length !== targetServiceIds.length)
                throw new common_1.NotFoundException('Service not found');
            const primaryService = services[0];
            const nextStatus = dto.markCompleted && appt.status !== client_1.AppointmentStatus.completed
                ? client_1.AppointmentStatus.completed
                : appt.status;
            if (nextStatus !== appt.status) {
                (0, appointment_state_machine_1.assertValidTransition)(appt.status, nextStatus);
            }
            const draftPricing = (0, pricing_util_1.computePricing)({
                servicePrices: services.map((s) => s.price),
                discount: dto.discount ?? appt.discount,
                manualPriceOverride: dto.manualPriceOverride ?? (appt.manualPriceOverride !== null ? appt.manualPriceOverride : undefined),
            });
            const discPol = (0, discount_policy_util_1.enforceDiscountPolicy)({
                baseTotal: draftPricing.baseTotal,
                discount: draftPricing.discount,
                role: auth.role,
            });
            const pricing = draftPricing;
            const endTime = new Date(appt.startTime.getTime() + primaryService.durationMinutes * 60 * 1000);
            await tx.appointment.updateMany({
                where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: appt.id }),
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
            if (nextStatus === client_1.AppointmentStatus.completed && appt.status !== client_1.AppointmentStatus.completed) {
                await this.applyCompletionEffectsTx(tx, auth, {
                    id: appt.id,
                    patientId: appt.patientId,
                    doctorId: appt.doctorId,
                    serviceId: primaryService.id,
                    baseTotal: pricing.baseTotal,
                    discount: pricing.discount,
                    finalTotal: pricing.finalTotal,
                    fallbackServicePrice: (0, decimal_money_util_1.money)(primaryService.price),
                    serviceIds: services.map((s) => s.id),
                });
            }
            await tx.session.upsert({
                where: { appointmentId: appt.id },
                update: {
                    status: nextStatus === client_1.AppointmentStatus.completed ? 'finalized' : 'in_progress',
                    finalizedAt: nextStatus === client_1.AppointmentStatus.completed ? new Date() : null,
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
                    status: nextStatus === client_1.AppointmentStatus.completed ? 'finalized' : 'in_progress',
                    finalizedAt: nextStatus === client_1.AppointmentStatus.completed ? new Date() : null,
                    consentObtained: !!dto.consentObtained,
                    treatmentDetails: dto.treatmentDetails,
                    doctorRemarks: dto.doctorRemarks,
                    specialConditions: dto.specialConditions,
                    finalTotal: pricing.finalTotal,
                },
            });
            if (appt.status === client_1.AppointmentStatus.completed) {
                const openInv = (0, appointment_invoice_helper_1.pickActiveInvoice)(appt.invoices);
                const pkgAdj = openInv ? (0, decimal_money_util_1.money)(openInv.packageAdjustment) : (0, decimal_money_util_1.d0)();
                const expectedFinal = (0, decimal_money_util_1.dMax)((0, decimal_money_util_1.money)(pricing.finalTotal).minus(pkgAdj), (0, decimal_money_util_1.d0)());
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
                where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: appt.id }),
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
            if (!updated)
                throw new common_1.NotFoundException('Appointment not found');
            return updated;
        });
    }
    async applyCompletionEffectsTx(tx, auth, appt) {
        const serviceIds = appt.serviceIds.length ? appt.serviceIds : [appt.serviceId];
        const packageCoveredAmount = await this.consumePackageSessionsTx(tx, {
            tenantId: auth.tenantId,
            patientId: appt.patientId,
            serviceIds,
        });
        const baseFinal = appt.finalTotal.gt((0, decimal_money_util_1.d0)()) ? appt.finalTotal : appt.fallbackServicePrice;
        const invoiceFinal = (0, decimal_money_util_1.dMax)(baseFinal.minus(packageCoveredAmount), (0, decimal_money_util_1.d0)());
        await this.invoicesService.createDraftForAppointmentTx(tx, {
            tenantId: auth.tenantId,
            patientId: appt.patientId,
            appointmentId: appt.id,
            totalAmount: appt.baseTotal.gt((0, decimal_money_util_1.d0)()) ? appt.baseTotal : appt.fallbackServicePrice,
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
    getAppointmentServiceIds(appt) {
        const ids = appt.appointmentServices?.map((x) => x.serviceId).filter(Boolean) || [];
        return ids.length ? ids : [appt.serviceId];
    }
    assertDoctorAccess(auth, doctorId) {
        if (auth.role !== client_1.UserRole.doctor)
            return;
        if (auth.userId === doctorId)
            return;
        throw new common_1.BadRequestException({
            message: 'Doctor can only modify their own appointments',
            code: 'DOCTOR_SCOPE_VIOLATION',
            status: 400,
        });
    }
    async consumePackageSessionsTx(tx, input) {
        const now = new Date();
        let coveredAmount = (0, decimal_money_util_1.d0)();
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
            if (!pkg)
                continue;
            const decremented = await tx.patientPackage.updateMany({
                where: { id: pkg.id, remainingSessions: { gt: 0 } },
                data: { remainingSessions: { decrement: 1 } },
            });
            if (decremented.count === 0)
                continue;
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
            coveredAmount = coveredAmount.plus((0, decimal_money_util_1.money)(pkg.pricePerSession));
            await this.domainEvents.emitTx(tx, {
                tenantId: input.tenantId,
                aggregateType: 'patient_package',
                aggregateId: pkg.id,
                eventType: 'PACKAGE_SESSION_CONSUMED',
                payload: {
                    patientId: input.patientId,
                    serviceId,
                    coveredAmount: (0, decimal_money_util_1.money)(pkg.pricePerSession).toString(),
                    remainingSessions: afterDecrement?.remainingSessions ?? 0,
                },
            });
        }
        return coveredAmount;
    }
};
exports.SessionLifecycleService = SessionLifecycleService;
exports.SessionLifecycleService = SessionLifecycleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        invoices_service_1.InvoicesService,
        domain_events_service_1.DomainEventsService,
        audit_log_service_1.AuditLogService])
], SessionLifecycleService);
//# sourceMappingURL=session-lifecycle.service.js.map