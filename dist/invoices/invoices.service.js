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
var InvoicesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../database/prisma.service");
const tenant_prisma_helper_1 = require("../common/tenant-prisma.helper");
const domain_events_service_1 = require("../common/events/domain-events.service");
const audit_log_service_1 = require("../common/audit/audit-log.service");
const notifications_service_1 = require("../notifications/notifications.service");
const decimal_money_util_1 = require("../common/billing/decimal-money.util");
let InvoicesService = InvoicesService_1 = class InvoicesService {
    prisma;
    domainEvents;
    auditLog;
    notifications;
    logger = new common_1.Logger(InvoicesService_1.name);
    constructor(prisma, domainEvents, auditLog, notifications) {
        this.prisma = prisma;
        this.domainEvents = domainEvents;
        this.auditLog = auditLog;
        this.notifications = notifications;
    }
    list(auth, query) {
        const page = Math.max(1, Number(query?.page || 1));
        const limit = Math.min(100, Math.max(1, Number(query?.limit || 50)));
        const where = (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, {
            status: query?.status,
            createdAt: query?.from || query?.to
                ? {
                    gte: query?.from ? new Date(query.from) : undefined,
                    lte: query?.to ? new Date(query.to) : undefined,
                }
                : undefined,
        });
        return this.prisma.$transaction(async (tx) => {
            const [items, total] = await Promise.all([
                tx.invoice.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: { patient: true, appointment: true, payments: true },
                }),
                tx.invoice.count({ where }),
            ]);
            return {
                items,
                meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
            };
        });
    }
    async findOne(auth, id) {
        const invoice = await this.prisma.invoice.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id }),
            include: {
                patient: true,
                appointment: true,
                payments: {
                    orderBy: { createdAt: 'asc' },
                    include: { refunds: true },
                },
            },
        });
        if (!invoice)
            throw new common_1.NotFoundException('Invoice not found');
        return invoice;
    }
    async pay(auth, id, input) {
        const invoice = await this.prisma.invoice.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id }),
        });
        if (!invoice)
            throw new common_1.NotFoundException('Invoice not found');
        if (invoice.status === 'paid') {
            throw new common_1.ConflictException({
                message: 'Invoice is already fully paid',
                code: 'INVOICE_ALREADY_PAID',
                status: 409,
            });
        }
        if (invoice.status === 'cancelled') {
            throw new common_1.ConflictException({
                message: 'Cannot pay a cancelled invoice',
                code: 'INVOICE_CANCELLED',
                status: 409,
            });
        }
        const balance = (0, decimal_money_util_1.money)(invoice.balance);
        const finalAmount = (0, decimal_money_util_1.money)(invoice.finalAmount);
        const amount = typeof input?.paidAmount === 'number' ? (0, decimal_money_util_1.money)(input.paidAmount) : balance.gt((0, decimal_money_util_1.d0)()) ? balance : finalAmount;
        if (amount.lte((0, decimal_money_util_1.d0)())) {
            throw new common_1.BadRequestException({
                message: 'Payment amount must be greater than zero',
                code: 'INVALID_PAID_AMOUNT',
                status: 400,
            });
        }
        if (amount.gt(balance)) {
            throw new common_1.BadRequestException({
                message: 'Paid amount cannot exceed the remaining invoice balance',
                code: 'INVALID_PAID_AMOUNT',
                status: 400,
            });
        }
        const paid = await this.prisma.$transaction(async (tx) => {
            if (input?.idempotencyKey) {
                const existingPayment = await tx.payment.findUnique({
                    where: { idempotencyKey: input.idempotencyKey },
                });
                if (existingPayment && existingPayment.invoiceId === invoice.id) {
                    this.logger.log(`Idempotent payment replay: key=${input.idempotencyKey} invoice=${id}`);
                    return tx.invoice.findUnique({
                        where: { id },
                        include: { payments: { where: { voidedAt: null } } },
                    });
                }
            }
            const amtStr = amount.toFixed(2);
            const updatedCount = await tx.invoice.updateMany({
                where: {
                    id,
                    tenantId: auth.tenantId,
                    deletedAt: null,
                    status: { in: ['draft', 'partial'] },
                    balance: { gte: amount },
                },
                data: {
                    totalPaid: { increment: amtStr },
                    balance: { decrement: amtStr },
                },
            });
            if (updatedCount.count === 0) {
                throw new common_1.ConflictException({
                    message: 'Invoice payment state changed concurrently — please refresh and retry',
                    code: 'INVOICE_ALREADY_PAID',
                    status: 409,
                });
            }
            const payment = await tx.payment.create({
                data: {
                    tenantId: auth.tenantId,
                    invoiceId: invoice.id,
                    amount,
                    method: input?.method || 'cash',
                    reference: input?.reference,
                    idempotencyKey: input?.idempotencyKey ?? null,
                },
            });
            const fresh = await tx.invoice.findUnique({
                where: { id },
                include: { payments: { where: { voidedAt: null } } },
            });
            if (!fresh)
                throw new common_1.NotFoundException('Invoice not found after payment');
            const bal = (0, decimal_money_util_1.money)(fresh.balance);
            const nextStatus = bal.lte((0, decimal_money_util_1.d0)()) ? 'paid' : 'partial';
            if (fresh.status !== nextStatus) {
                await tx.invoice.update({ where: { id: fresh.id }, data: { status: nextStatus } });
                fresh.status = nextStatus;
            }
            if (invoice.appointmentId && nextStatus === 'paid') {
                await tx.appointment.updateMany({
                    where: {
                        id: invoice.appointmentId,
                        tenantId: auth.tenantId,
                        deletedAt: null,
                        status: client_1.AppointmentStatus.completed,
                    },
                    data: { status: client_1.AppointmentStatus.paid },
                });
            }
            await this.domainEvents.emitTx(tx, {
                tenantId: auth.tenantId,
                aggregateType: 'invoice',
                aggregateId: invoice.id,
                eventType: 'INVOICE_PAYMENT_RECORDED',
                payload: {
                    invoiceId: invoice.id,
                    appointmentId: invoice.appointmentId,
                    paymentId: payment.id,
                    amount: amount.toString(),
                    method: payment.method,
                    nextStatus,
                },
            });
            await this.auditLog.logTx(tx, {
                tenantId: auth.tenantId,
                actorUserId: auth.userId,
                action: 'invoice.pay',
                entityType: 'invoice',
                entityId: invoice.id,
                metadata: {
                    paymentId: payment.id,
                    amount: amount.toString(),
                    method: payment.method,
                    reference: payment.reference,
                    nextStatus,
                },
            });
            this.logger.log(`Payment recorded: invoice=${id} amount=${amount.toString()} user=${auth.userId}`);
            return fresh;
        });
        if (!paid)
            throw new common_1.NotFoundException('Invoice not found');
        if (paid.status === 'partial') {
            try {
                await this.notifications.notifyUsersWithRoles(auth.tenantId, [client_1.UserRole.admin, client_1.UserRole.receptionist], client_1.NotificationSeverity.warning, `زيارة غير مدفوعة بالكامل — رصيد متبقي: ${(0, decimal_money_util_1.money)(paid.balance).toFixed(2)}`);
            }
            catch (err) {
                this.logger.warn(`Partial-payment notification failed: ${String(err)}`);
            }
        }
        return paid;
    }
    async voidPayment(auth, paymentId) {
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findFirst({
                where: { id: paymentId, tenantId: auth.tenantId, voidedAt: null },
                include: { invoice: true },
            });
            if (!payment)
                throw new common_1.NotFoundException('Payment not found or already voided');
            const invoice = payment.invoice;
            if (invoice.tenantId !== auth.tenantId) {
                throw new common_1.NotFoundException('Payment not found');
            }
            await tx.payment.update({
                where: { id: paymentId },
                data: { voidedAt: new Date() },
            });
            const amount = (0, decimal_money_util_1.money)(payment.amount);
            const prevPaid = (0, decimal_money_util_1.money)(invoice.totalPaid);
            const newTotalPaid = (0, decimal_money_util_1.dMax)(prevPaid.minus(amount), (0, decimal_money_util_1.d0)());
            const nextStatus = newTotalPaid.lte((0, decimal_money_util_1.d0)()) ? 'draft' : 'partial';
            await tx.invoice.update({
                where: { id: invoice.id },
                data: {
                    totalPaid: newTotalPaid,
                    balance: (0, decimal_money_util_1.money)(invoice.finalAmount).minus(newTotalPaid),
                    status: nextStatus,
                },
            });
            if (invoice.appointmentId) {
                await tx.appointment.updateMany({
                    where: {
                        id: invoice.appointmentId,
                        tenantId: auth.tenantId,
                        deletedAt: null,
                        status: client_1.AppointmentStatus.paid,
                    },
                    data: { status: client_1.AppointmentStatus.completed },
                });
            }
            await this.domainEvents.emitTx(tx, {
                tenantId: auth.tenantId,
                aggregateType: 'invoice',
                aggregateId: invoice.id,
                eventType: 'INVOICE_PAYMENT_VOIDED',
                payload: {
                    invoiceId: invoice.id,
                    paymentId,
                    amount: amount.toString(),
                    nextStatus,
                },
            });
            await this.auditLog.logTx(tx, {
                tenantId: auth.tenantId,
                actorUserId: auth.userId,
                action: 'invoice.payment.void',
                entityType: 'invoice',
                entityId: invoice.id,
                metadata: { paymentId, amount: amount.toString(), nextStatus },
            });
            this.logger.log(`Payment voided: ${paymentId} on invoice ${invoice.id} by user ${auth.userId}`);
            return tx.invoice.findUnique({
                where: { id: invoice.id },
                include: { payments: { where: { voidedAt: null } } },
            });
        });
    }
    async refundPayment(auth, paymentId, input) {
        const refundAmt = (0, decimal_money_util_1.money)(input.amount);
        if (refundAmt.lte((0, decimal_money_util_1.d0)())) {
            throw new common_1.BadRequestException({ message: 'Refund amount must be positive', code: 'INVALID_REFUND' });
        }
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findFirst({
                where: { id: paymentId, tenantId: auth.tenantId, voidedAt: null },
                include: { refunds: true },
            });
            if (!payment)
                throw new common_1.NotFoundException('Payment not found or voided');
            const cap = (0, decimal_money_util_1.money)(payment.amount);
            const already = (0, decimal_money_util_1.dSum)((payment.refunds ?? []).map((r) => (0, decimal_money_util_1.money)(r.amount)));
            const remaining = cap.minus(already);
            if (refundAmt.gt(remaining)) {
                throw new common_1.BadRequestException({
                    message: 'Refund exceeds remaining refundable amount for this payment',
                    code: 'REFUND_OVER_CAP',
                });
            }
            const row = await tx.refund.create({
                data: {
                    tenantId: auth.tenantId,
                    paymentId,
                    amount: refundAmt,
                    reason: input.reason ?? null,
                    actorUserId: auth.userId,
                },
            });
            await this.auditLog.logTx(tx, {
                tenantId: auth.tenantId,
                actorUserId: auth.userId,
                action: 'payment.refund',
                entityType: 'payment',
                entityId: paymentId,
                metadata: {
                    refundId: row.id,
                    amount: refundAmt.toString(),
                    reason: input.reason ?? null,
                },
            });
            await this.domainEvents.emitTx(tx, {
                tenantId: auth.tenantId,
                aggregateType: 'payment',
                aggregateId: paymentId,
                eventType: 'PAYMENT_REFUND_RECORDED',
                payload: {
                    refundId: row.id,
                    amount: refundAmt.toString(),
                    invoiceId: payment.invoiceId,
                },
            });
            return row;
        });
    }
    async createDraftForAppointmentTx(tx, input) {
        const existing = await tx.invoice.findFirst({
            where: {
                appointmentId: input.appointmentId,
                tenantId: input.tenantId,
                deletedAt: null,
                status: { not: 'cancelled' },
            },
        });
        if (existing)
            return existing;
        const discount = (0, decimal_money_util_1.money)(input.discount);
        const totalAmount = (0, decimal_money_util_1.money)(input.totalAmount);
        const computedFinal = (0, decimal_money_util_1.dMax)(totalAmount.minus(discount), (0, decimal_money_util_1.d0)());
        const finalAmount = input.finalAmountOverride !== undefined && input.finalAmountOverride !== null
            ? (0, decimal_money_util_1.dMax)((0, decimal_money_util_1.money)(input.finalAmountOverride), (0, decimal_money_util_1.d0)())
            : computedFinal;
        const packageAdjustment = (0, decimal_money_util_1.money)(input.packageAdjustment);
        const updatedTenant = await tx.tenant.update({
            where: { id: input.tenantId },
            data: { invoiceSeq: { increment: 1 } },
            select: { invoiceSeq: true },
        });
        const year = new Date().getFullYear();
        const invoiceNumber = `INV-${year}-${String(updatedTenant.invoiceSeq).padStart(5, '0')}`;
        const created = await tx.invoice.create({
            data: {
                tenantId: input.tenantId,
                patientId: input.patientId,
                appointmentId: input.appointmentId,
                invoiceNumber,
                totalAmount,
                discount,
                finalAmount,
                packageAdjustment,
                totalPaid: (0, decimal_money_util_1.d0)(),
                balance: finalAmount,
                status: 'draft',
            },
        });
        await this.domainEvents.emitTx(tx, {
            tenantId: input.tenantId,
            aggregateType: 'invoice',
            aggregateId: created.id,
            eventType: 'INVOICE_DRAFT_CREATED',
            payload: {
                appointmentId: input.appointmentId,
                patientId: input.patientId,
                invoiceNumber,
                totalAmount: totalAmount.toString(),
                discount: discount.toString(),
                finalAmount: finalAmount.toString(),
                packageAdjustment: packageAdjustment.toString(),
            },
        });
        this.logger.log(`Draft invoice ${invoiceNumber} created for appointment ${input.appointmentId}`);
        return created;
    }
    async syncInvoiceWithAppointmentTx(tx, auth, input) {
        const inv = await tx.invoice.findFirst({
            where: {
                tenantId: auth.tenantId,
                appointmentId: input.appointmentId,
                deletedAt: null,
                status: { not: 'cancelled' },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                payments: { where: { voidedAt: null } },
            },
        });
        if (!inv)
            return 'noop';
        const targetTotal = input.totalAmount;
        const targetDisc = input.discount;
        const targetFinal = input.finalAmount;
        const targetPkg = input.packageAdjustment;
        if ((0, decimal_money_util_1.dEq)((0, decimal_money_util_1.money)(inv.totalAmount), targetTotal) &&
            (0, decimal_money_util_1.dEq)((0, decimal_money_util_1.money)(inv.discount), targetDisc) &&
            (0, decimal_money_util_1.dEq)((0, decimal_money_util_1.money)(inv.finalAmount), targetFinal) &&
            (0, decimal_money_util_1.dEq)((0, decimal_money_util_1.money)(inv.packageAdjustment), targetPkg)) {
            return 'noop';
        }
        const payments = inv.payments ?? [];
        const paidSum = (0, decimal_money_util_1.dSum)(payments.map((p) => (0, decimal_money_util_1.money)(p.amount)));
        if (payments.length === 0) {
            const totalPaid = (0, decimal_money_util_1.money)(inv.totalPaid);
            const nextBalance = targetFinal.minus(totalPaid);
            const nextStatus = this.invoiceStatusFromPaid(targetFinal, totalPaid);
            await tx.invoice.update({
                where: { id: inv.id },
                data: {
                    totalAmount: targetTotal,
                    discount: targetDisc,
                    finalAmount: targetFinal,
                    packageAdjustment: targetPkg,
                    balance: nextBalance,
                    status: nextStatus,
                },
            });
            await this.auditLog.logTx(tx, {
                tenantId: auth.tenantId,
                actorUserId: auth.userId,
                action: 'invoice.sync_update',
                entityType: 'invoice',
                entityId: inv.id,
                metadata: {
                    appointmentId: input.appointmentId,
                    before: {
                        totalAmount: (0, decimal_money_util_1.money)(inv.totalAmount).toString(),
                        discount: (0, decimal_money_util_1.money)(inv.discount).toString(),
                        finalAmount: (0, decimal_money_util_1.money)(inv.finalAmount).toString(),
                    },
                    after: {
                        totalAmount: targetTotal.toString(),
                        discount: targetDisc.toString(),
                        finalAmount: targetFinal.toString(),
                    },
                },
            });
            await this.domainEvents.emitTx(tx, {
                tenantId: auth.tenantId,
                aggregateType: 'invoice',
                aggregateId: inv.id,
                eventType: 'INVOICE_TOTALS_UPDATED',
                payload: { appointmentId: input.appointmentId, invoiceId: inv.id },
            });
            return 'updated';
        }
        await tx.invoice.update({
            where: { id: inv.id },
            data: {
                status: 'cancelled',
                totalPaid: (0, decimal_money_util_1.d0)(),
                balance: (0, decimal_money_util_1.d0)(),
            },
        });
        const updatedTenant = await tx.tenant.update({
            where: { id: auth.tenantId },
            data: { invoiceSeq: { increment: 1 } },
            select: { invoiceSeq: true },
        });
        const year = new Date().getFullYear();
        const invoiceNumber = `INV-${year}-${String(updatedTenant.invoiceSeq).padStart(5, '0')}`;
        const nextBalance = targetFinal.minus(paidSum);
        const nextStatus = this.invoiceStatusFromPaid(targetFinal, paidSum);
        const created = await tx.invoice.create({
            data: {
                tenantId: auth.tenantId,
                patientId: inv.patientId,
                appointmentId: input.appointmentId,
                invoiceNumber,
                totalAmount: targetTotal,
                discount: targetDisc,
                finalAmount: targetFinal,
                packageAdjustment: targetPkg,
                totalPaid: paidSum,
                balance: (0, decimal_money_util_1.dMax)(nextBalance, (0, decimal_money_util_1.d0)()),
                status: nextStatus,
            },
        });
        await tx.payment.updateMany({
            where: { invoiceId: inv.id, voidedAt: null },
            data: { invoiceId: created.id },
        });
        await this.auditLog.logTx(tx, {
            tenantId: auth.tenantId,
            actorUserId: auth.userId,
            action: 'invoice.supersede',
            entityType: 'invoice',
            entityId: created.id,
            metadata: {
                appointmentId: input.appointmentId,
                priorInvoiceId: inv.id,
                priorInvoiceNumber: inv.invoiceNumber,
                newInvoiceNumber: invoiceNumber,
                movedPayments: payments.map((p) => p.id),
            },
        });
        await this.domainEvents.emitTx(tx, {
            tenantId: auth.tenantId,
            aggregateType: 'invoice',
            aggregateId: created.id,
            eventType: 'INVOICE_SUPERSEDED',
            payload: {
                appointmentId: input.appointmentId,
                priorInvoiceId: inv.id,
                newInvoiceId: created.id,
            },
        });
        return 'superseded';
    }
    invoiceStatusFromPaid(finalAmount, totalPaid) {
        const bal = finalAmount.minus(totalPaid);
        if (bal.lte((0, decimal_money_util_1.d0)()))
            return 'paid';
        if (totalPaid.gt((0, decimal_money_util_1.d0)()))
            return 'partial';
        return 'draft';
    }
    async cancelDraftInvoiceForAppointmentTx(tx, tenantId, appointmentId, actorUserId) {
        const invoice = await tx.invoice.findFirst({
            where: { appointmentId, tenantId, status: 'draft', deletedAt: null },
        });
        if (!invoice)
            return;
        await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: 'cancelled' },
        });
        await this.domainEvents.emitTx(tx, {
            tenantId,
            aggregateType: 'invoice',
            aggregateId: invoice.id,
            eventType: 'INVOICE_CANCELLED',
            payload: { invoiceId: invoice.id, appointmentId, invoiceNumber: invoice.invoiceNumber },
        });
        await this.auditLog.logTx(tx, {
            tenantId,
            actorUserId,
            action: 'invoice.cancel',
            entityType: 'invoice',
            entityId: invoice.id,
            metadata: { appointmentId, invoiceNumber: invoice.invoiceNumber, reason: 'appointment_no_show_or_removed' },
        });
        this.logger.log(`Invoice ${invoice.invoiceNumber ?? invoice.id} cancelled for appointment ${appointmentId}`);
    }
    async runBillingIntegritySweep() {
        let paymentMismatch = 0;
        let appointmentMismatch = 0;
        const tenants = await this.prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } });
        for (const { id: tenantId } of tenants) {
            const invoices = await this.prisma.invoice.findMany({
                where: { tenantId, deletedAt: null, status: { not: 'cancelled' } },
                select: {
                    id: true,
                    totalAmount: true,
                    discount: true,
                    totalPaid: true,
                    balance: true,
                    finalAmount: true,
                    packageAdjustment: true,
                    appointmentId: true,
                    appointment: {
                        select: {
                            baseTotal: true,
                            discount: true,
                            finalTotal: true,
                        },
                    },
                },
            });
            for (const inv of invoices) {
                const sumPay = await this.prisma.payment.aggregate({
                    where: { invoiceId: inv.id, voidedAt: null },
                    _sum: { amount: true },
                });
                const paid = (0, decimal_money_util_1.money)(sumPay._sum.amount ?? 0);
                if (!(0, decimal_money_util_1.dEq)(paid, (0, decimal_money_util_1.money)(inv.totalPaid))) {
                    paymentMismatch += 1;
                    this.logger.error(`Billing integrity: invoice ${inv.id} totalPaid ${(0, decimal_money_util_1.money)(inv.totalPaid).toString()} != payments ${paid.toString()}`);
                }
                const ap = inv.appointment;
                if (ap) {
                    const expectedFinal = (0, decimal_money_util_1.dMax)((0, decimal_money_util_1.money)(ap.finalTotal).minus((0, decimal_money_util_1.money)(inv.packageAdjustment)), (0, decimal_money_util_1.d0)());
                    if (!(0, decimal_money_util_1.dEq)((0, decimal_money_util_1.money)(inv.finalAmount), expectedFinal)) {
                        appointmentMismatch += 1;
                        this.logger.warn(`Billing integrity: invoice ${inv.id} finalAmount mismatch vs appointment (expected ~${expectedFinal.toString()})`);
                    }
                    if (!(0, decimal_money_util_1.dEq)((0, decimal_money_util_1.money)(ap.baseTotal), (0, decimal_money_util_1.money)(inv.totalAmount)) || !(0, decimal_money_util_1.dEq)((0, decimal_money_util_1.money)(ap.discount), (0, decimal_money_util_1.money)(inv.discount))) {
                        appointmentMismatch += 1;
                        this.logger.warn(`Billing integrity: invoice ${inv.id} base/discount drift vs appointment`);
                    }
                }
            }
        }
        return { paymentMismatch, appointmentMismatch };
    }
};
exports.InvoicesService = InvoicesService;
exports.InvoicesService = InvoicesService = InvoicesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        domain_events_service_1.DomainEventsService,
        audit_log_service_1.AuditLogService,
        notifications_service_1.NotificationsService])
], InvoicesService);
//# sourceMappingURL=invoices.service.js.map