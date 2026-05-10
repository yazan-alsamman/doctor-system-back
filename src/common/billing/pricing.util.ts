import { Prisma } from '@prisma/client';
import { d0, dMax, dMin, money } from './decimal-money.util';

export interface PricingDecimal {
  baseTotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  finalTotal: Prisma.Decimal;
}

/**
 * Authoritative pricing — all amounts as Decimal end-to-end.
 * Rules: discount capped to baseTotal; finalTotal from override or (base − discount).
 */
export function computePricing(input: {
  servicePrices: Array<Prisma.Decimal | string | number>;
  discount?: Prisma.Decimal | string | number | null;
  manualPriceOverride?: Prisma.Decimal | string | number | null;
}): PricingDecimal {
  const baseTotal = input.servicePrices.reduce<Prisma.Decimal>(
    (sum, v) => sum.plus(money(v)),
    d0(),
  );
  const rawDiscount = dMax(money(input.discount), d0());
  const discount = dMin(rawDiscount, baseTotal);
  const fallbackFinal = dMax(baseTotal.minus(discount), d0());
  const finalTotal =
    input.manualPriceOverride !== undefined && input.manualPriceOverride !== null
      ? dMax(money(input.manualPriceOverride), d0())
      : fallbackFinal;
  return { baseTotal, discount, finalTotal };
}
