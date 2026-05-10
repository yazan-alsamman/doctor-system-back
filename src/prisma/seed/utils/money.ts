import { Prisma } from '@prisma/client';

export function money(n: number): Prisma.Decimal {
  return new Prisma.Decimal(String(Math.round(n * 100) / 100));
}

export function moneyMul(d: Prisma.Decimal, factor: number): Prisma.Decimal {
  const x = Number(d.toString()) * factor;
  return money(x);
}
