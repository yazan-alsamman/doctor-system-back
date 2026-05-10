import { InvoiceStatus, Prisma } from '@prisma/client';
import { money } from '../utils/money';

export function createInvoiceRow(
  base: Prisma.InvoiceCreateManyInput,
  overrides?: Partial<Prisma.InvoiceCreateManyInput>,
): Prisma.InvoiceCreateManyInput {
  const merged = { ...base, ...overrides };
  if (merged.balance == null) merged.balance = money(0);
  if (merged.totalPaid == null) merged.totalPaid = money(0);
  if (!merged.status) merged.status = InvoiceStatus.draft;
  return merged;
}
