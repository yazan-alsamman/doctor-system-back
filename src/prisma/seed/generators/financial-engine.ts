import {
  AppointmentStatus,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import type { Rng } from '../core/rng';
import { money } from '../utils/money';
import { seededUuid } from '../utils/uuid';
import type { BuiltAppointment } from './scheduling-engine';

export interface FinancialPlan {
  invoices: Prisma.InvoiceCreateManyInput[];
  payments: Prisma.PaymentCreateManyInput[];
  refunds: Prisma.RefundCreateManyInput[];
  nextInvoiceSeqOffset: number;
}

export function buildFinancialPlan(args: {
  tenantId: string;
  built: BuiltAppointment[];
  rng: Rng;
  revenueJitter: number;
  invoiceSeqStart: number;
}): FinancialPlan {
  const { tenantId, built, rng, invoiceSeqStart } = args;
  const invoices: Prisma.InvoiceCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const refunds: Prisma.RefundCreateManyInput[] = [];

  let invCounter = 0;
  let payCounter = 0;
  let seq = invoiceSeqStart;

  const shouldInvoice = (st: AppointmentStatus) =>
    st === AppointmentStatus.paid ||
    st === AppointmentStatus.completed ||
    st === AppointmentStatus.arrived ||
    st === AppointmentStatus.in_consultation;

  const year = new Date().getFullYear();

  for (const { row } of built) {
    const st = row.status as AppointmentStatus;
    if (!shouldInvoice(st)) continue;

    const total = Number((row.baseTotal as Prisma.Decimal).toString());
    const disc = Number((row.discount as Prisma.Decimal).toString());
    const finalAmt = Number((row.finalTotal as Prisma.Decimal).toString());

    const invoiceId = seededUuid(`inv:${tenantId}`, invCounter++);
    seq += 1;
    const invoiceNumber = `INV-${year}-${String(seq).padStart(5, '0')}`;

    if (st === AppointmentStatus.paid) {
      const variance = 1 + (rng.next() - 0.5) * 0.04 * args.revenueJitter;
      const adjusted = money(Math.round(finalAmt * variance * 100) / 100);
      invoices.push({
        id: invoiceId,
        tenantId,
        patientId: row.patientId as string,
        appointmentId: row.id as string,
        invoiceNumber,
        totalAmount: money(total),
        discount: money(disc),
        finalAmount: adjusted,
        status: InvoiceStatus.paid,
        totalPaid: adjusted,
        balance: money(0),
      });
      const payId = seededUuid(`pay:${tenantId}`, payCounter++);
      const method =
        rng.next() < 0.62
          ? PaymentMethod.cash
          : rng.next() < 0.88
            ? PaymentMethod.card
            : rng.next() < 0.96
              ? PaymentMethod.transfer
              : PaymentMethod.other;
      payments.push({
        id: payId,
        tenantId,
        invoiceId,
        amount: adjusted,
        method,
        reference: rng.bernoulli(0.25) ? `REF-${rng.nextInt(10000, 99999)}` : null,
      });

      if (rng.bernoulli(0.018)) {
        const refundAmt = money(
          Math.min(Number(adjusted.toString()) * 0.35, Number(adjusted.toString()) * rng.next()),
        );
        if (Number(refundAmt.toString()) > 0) {
          refunds.push({
            tenantId,
            paymentId: payId,
            amount: refundAmt,
            reason: rng.pick([
              'استرداد بناءً على طلب المريض',
              'إلغاء إجراء جزئي',
              'تعديل فاتورة — موافقة الإدارة',
            ]),
            actorUserId: null,
          });
        }
      }
      continue;
    }

    // completed / arrived / in_consultation → draft or partial
    const partial =
      st === AppointmentStatus.completed && rng.bernoulli(0.38)
        ? true
        : st === AppointmentStatus.arrived && rng.bernoulli(0.22);

    const paidPortion = partial
      ? rng.next() * 0.55 + 0.15
      : st === AppointmentStatus.in_consultation && rng.bernoulli(0.3)
        ? rng.next() * 0.25
        : 0;

    const paidAmt = money(Math.round(finalAmt * paidPortion / 1000) * 1000);
    const balance = money(Math.max(0, finalAmt - Number(paidAmt.toString())));
    const status =
      Number(balance.toString()) <= 0.01
        ? InvoiceStatus.paid
        : Number(paidAmt.toString()) > 0
          ? InvoiceStatus.partial
          : InvoiceStatus.draft;

    invoices.push({
      id: invoiceId,
      tenantId,
      patientId: row.patientId as string,
      appointmentId: row.id as string,
      invoiceNumber,
      totalAmount: money(total),
      discount: money(disc),
      finalAmount: money(finalAmt),
      status,
      totalPaid: paidAmt,
      balance,
    });

    if (Number(paidAmt.toString()) > 0) {
      const payId = seededUuid(`pay:${tenantId}`, payCounter++);
      payments.push({
        id: payId,
        tenantId,
        invoiceId,
        amount: paidAmt,
        method: rng.pick([PaymentMethod.cash, PaymentMethod.card, PaymentMethod.transfer]),
      });
    }
  }

  return { invoices, payments, refunds, nextInvoiceSeqOffset: seq - invoiceSeqStart };
}
