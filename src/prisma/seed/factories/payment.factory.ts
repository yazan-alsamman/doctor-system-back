import { PaymentMethod, Prisma } from '@prisma/client';

export function createPaymentRow(
  base: Prisma.PaymentCreateManyInput,
  overrides?: Partial<Prisma.PaymentCreateManyInput>,
): Prisma.PaymentCreateManyInput {
  const merged = { ...base, ...overrides };
  if (!merged.method) merged.method = PaymentMethod.cash;
  return merged;
}
