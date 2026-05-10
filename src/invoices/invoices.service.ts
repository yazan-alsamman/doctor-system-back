import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, NotificationSeverity, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthContext } from '../common/auth-context';
import { tenantWhere } from '../common/tenant-prisma.helper';
import { DomainEventsService } from '../common/events/domain-events.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { d0, dEq, dMax, dSum, money } from '../common/billing/decimal-money.util';

type Tx = Prisma.TransactionClient;

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEvents: DomainEventsService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  list(
    auth: AuthContext,
    query?: {
      status?: 'draft' | 'partial' | 'paid' | 'cancelled';
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(query?.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query?.limit || 50)));
    const where: Prisma.InvoiceWhereInput = tenantWhere(auth.tenantId, {
      status: query?.status,
      createdAt:
        query?.from || query?.to
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

  async findOne(auth: AuthContext, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: tenantWhere(auth.tenantId, { id }),
      include: {
        patient: true,
        appointment: true,
        payments: {
          orderBy: { createdAt: 'asc' },
          include: { refunds: true },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async pay(
    auth: AuthContext,
    id: string,
    input?: {
      paidAmount?: number;
      method?: 'cash' | 'card' | 'transfer' | 'other';
      reference?: string;
      idempotencyKey?: string;
    },
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: tenantWhere(auth.tenantId, { id }),
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === 'paid') {
      throw new ConflictException({
        message: 'Invoice is already fully paid',
        code: 'INVOICE_ALREADY_PAID',
        status: 409,
      });
    }
    if (invoice.status === 'cancelled') {
      throw new ConflictException({
        message: 'Cannot pay a cancelled invoice',
        code: 'INVOICE_CANCELLED',
        status: 409,
      });
    }

    const balance = money(invoice.balance);
    const finalAmount = money(invoice.finalAmount);
    const amount =
      typeof input?.paidAmount === 'number' ? money(input.paidAmount) : balance.gt(d0()) ? balance : finalAmount;

    if (amount.lte(d0())) {
      throw new BadRequestException({
        message: 'Payment amount must be greater than zero',
        code: 'INVALID_PAID_AMOUNT',
        status: 400,
      });
    }
    if (amount.gt(balance)) {
      throw new BadRequestException({
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
        throw new ConflictException({
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
      if (!fresh) throw new NotFoundException('Invoice not found after payment');

      const bal = money(fresh.balance);
      const nextStatus: 'paid' | 'partial' = bal.lte(d0()) ? 'paid' : 'partial';
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
            status: AppointmentStatus.completed,
          },
          data: { status: AppointmentStatus.paid },
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

    if (!paid) throw new NotFoundException('Invoice not found');

    if (paid.status === 'partial') {
      try {
        await this.notifications.notifyUsersWithRoles(
          auth.tenantId,
          [UserRole.admin, UserRole.receptionist],
          NotificationSeverity.warning,
          `زيارة غير مدفوعة بالكامل — رصيد متبقي: ${money(paid.balance).toFixed(2)}`,
        );
      } catch (err) {
        this.logger.warn(`Partial-payment notification failed: ${String(err)}`);
      }
    }

    return paid;
  }

  async voidPayment(auth: AuthContext, paymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId: auth.tenantId, voidedAt: null },
        include: { invoice: true },
      });
      if (!payment) throw new NotFoundException('Payment not found or already voided');

      const invoice = payment.invoice;
      if (invoice.tenantId !== auth.tenantId) {
        throw new NotFoundException('Payment not found');
      }

      await tx.payment.update({
        where: { id: paymentId },
        data: { voidedAt: new Date() },
      });

      const amount = money(payment.amount);
      const prevPaid = money(invoice.totalPaid);
      const newTotalPaid = dMax(prevPaid.minus(amount), d0());

      const nextStatus: 'draft' | 'partial' = newTotalPaid.lte(d0()) ? 'draft' : 'partial';

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          totalPaid: newTotalPaid,
          balance: money(invoice.finalAmount).minus(newTotalPaid),
          status: nextStatus,
        },
      });

      if (invoice.appointmentId) {
        await tx.appointment.updateMany({
          where: {
            id: invoice.appointmentId,
            tenantId: auth.tenantId,
            deletedAt: null,
            status: AppointmentStatus.paid,
          },
          data: { status: AppointmentStatus.completed },
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

  /**
   * Partial refunds — ledger only; invoice totals unchanged (use void payment for AR reversal).
   */
  async refundPayment(
    auth: AuthContext,
    paymentId: string,
    input: { amount: Prisma.Decimal | string | number; reason?: string },
  ) {
    const refundAmt = money(input.amount);
    if (refundAmt.lte(d0())) {
      throw new BadRequestException({ message: 'Refund amount must be positive', code: 'INVALID_REFUND' });
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId: auth.tenantId, voidedAt: null },
        include: { refunds: true },
      });
      if (!payment) throw new NotFoundException('Payment not found or voided');

      const cap = money(payment.amount);
      const already = dSum((payment.refunds ?? []).map((r) => money(r.amount)));
      const remaining = cap.minus(already);
      if (refundAmt.gt(remaining)) {
        throw new BadRequestException({
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

  async createDraftForAppointmentTx(
    tx: Tx,
    input: {
      tenantId: string;
      patientId: string;
      appointmentId: string;
      totalAmount: Prisma.Decimal | string | number;
      discount?: Prisma.Decimal | string | number;
      finalAmountOverride?: Prisma.Decimal | string | number;
      packageAdjustment?: Prisma.Decimal | string | number;
    },
  ) {
    const existing = await tx.invoice.findFirst({
      where: {
        appointmentId: input.appointmentId,
        tenantId: input.tenantId,
        deletedAt: null,
        status: { not: 'cancelled' },
      },
    });
    if (existing) return existing;

    const discount = money(input.discount);
    const totalAmount = money(input.totalAmount);
    const computedFinal = dMax(totalAmount.minus(discount), d0());
    const finalAmount =
      input.finalAmountOverride !== undefined && input.finalAmountOverride !== null
        ? dMax(money(input.finalAmountOverride), d0())
        : computedFinal;
    const packageAdjustment = money(input.packageAdjustment);

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
        totalPaid: d0(),
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

  /**
   * When appointment pricing diverges from the open invoice: update in place if no payments;
   * otherwise cancel + new invoice and move payments (transactional).
   */
  async syncInvoiceWithAppointmentTx(
    tx: Tx,
    auth: AuthContext,
    input: {
      appointmentId: string;
      totalAmount: Prisma.Decimal;
      discount: Prisma.Decimal;
      finalAmount: Prisma.Decimal;
      packageAdjustment: Prisma.Decimal;
    },
  ): Promise<'noop' | 'updated' | 'superseded'> {
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

    if (!inv) return 'noop';

    const targetTotal = input.totalAmount;
    const targetDisc = input.discount;
    const targetFinal = input.finalAmount;
    const targetPkg = input.packageAdjustment;

    if (
      dEq(money(inv.totalAmount), targetTotal) &&
      dEq(money(inv.discount), targetDisc) &&
      dEq(money(inv.finalAmount), targetFinal) &&
      dEq(money(inv.packageAdjustment), targetPkg)
    ) {
      return 'noop';
    }

    const payments = inv.payments ?? [];
    const paidSum = dSum(payments.map((p) => money(p.amount)));

    if (payments.length === 0) {
      const totalPaid = money(inv.totalPaid);
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
            totalAmount: money(inv.totalAmount).toString(),
            discount: money(inv.discount).toString(),
            finalAmount: money(inv.finalAmount).toString(),
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
        totalPaid: d0(),
        balance: d0(),
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
        balance: dMax(nextBalance, d0()),
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

  private invoiceStatusFromPaid(finalAmount: Prisma.Decimal, totalPaid: Prisma.Decimal): 'draft' | 'partial' | 'paid' {
    const bal = finalAmount.minus(totalPaid);
    if (bal.lte(d0())) return 'paid';
    if (totalPaid.gt(d0())) return 'partial';
    return 'draft';
  }

  async cancelDraftInvoiceForAppointmentTx(tx: Tx, tenantId: string, appointmentId: string, actorUserId: string) {
    const invoice = await tx.invoice.findFirst({
      where: { appointmentId, tenantId, status: 'draft', deletedAt: null },
    });
    if (!invoice) return;

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

  /** Daily integrity checks — logs anomalies (does not mutate). */
  async runBillingIntegritySweep(): Promise<{ paymentMismatch: number; appointmentMismatch: number }> {
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
        const paid = money(sumPay._sum.amount ?? 0);
        if (!dEq(paid, money(inv.totalPaid))) {
          paymentMismatch += 1;
          this.logger.error(
            `Billing integrity: invoice ${inv.id} totalPaid ${money(inv.totalPaid).toString()} != payments ${paid.toString()}`,
          );
        }

        const ap = inv.appointment;
        if (ap) {
          const expectedFinal = dMax(money(ap.finalTotal).minus(money(inv.packageAdjustment)), d0());
          if (!dEq(money(inv.finalAmount), expectedFinal)) {
            appointmentMismatch += 1;
            this.logger.warn(
              `Billing integrity: invoice ${inv.id} finalAmount mismatch vs appointment (expected ~${expectedFinal.toString()})`,
            );
          }
          if (!dEq(money(ap.baseTotal), money(inv.totalAmount)) || !dEq(money(ap.discount), money(inv.discount))) {
            appointmentMismatch += 1;
            this.logger.warn(`Billing integrity: invoice ${inv.id} base/discount drift vs appointment`);
          }
        }
      }
    }

    return { paymentMismatch, appointmentMismatch };
  }
}
