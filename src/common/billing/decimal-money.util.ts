import { Prisma } from '@prisma/client';

/** Fixed money scale for equality checks (0.01 currency units). */
const MONEY_EPS = new Prisma.Decimal('0.009');

export const d0 = () => new Prisma.Decimal(0);

export function money(
  v: Prisma.Decimal | string | number | null | undefined,
): Prisma.Decimal {
  if (v === null || v === undefined) return d0();
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(String(v));
}

export function dSum(vals: Prisma.Decimal[]): Prisma.Decimal {
  return vals.reduce((a, b) => a.plus(b), d0());
}

export function dEq(
  a: Prisma.Decimal,
  b: Prisma.Decimal,
  epsilon: Prisma.Decimal = MONEY_EPS,
): boolean {
  return a.minus(b).abs().lte(epsilon);
}

export function dGt(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.gt(b);
}

export function dGte(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.gte(b);
}

export function dLt(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.lt(b);
}

export function dLte(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.lte(b);
}

export function dMin(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.lte(b) ? a : b;
}

export function dMax(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.gte(b) ? a : b;
}

export function dClampLower(value: Prisma.Decimal, min: Prisma.Decimal): Prisma.Decimal {
  return dMax(value, min);
}

export function dDiv(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  if (b.isZero()) return d0();
  return a.dividedBy(b);
}
