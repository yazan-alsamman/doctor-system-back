import type { Invoice } from '@prisma/client';

/** Prefer latest non-cancelled, non-deleted invoice for an appointment. */
export function pickActiveInvoice(invoices: Invoice[] | null | undefined): Invoice | null {
  if (!invoices?.length) return null;
  const open = invoices.filter((i) => i.status !== 'cancelled' && !i.deletedAt);
  if (open.length) {
    return [...open].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!;
  }
  return [...invoices].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!;
}
