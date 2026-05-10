import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { d0, dDiv, money } from './decimal-money.util';

export type DiscountSeverity = 'none' | 'warn_gt_50pct' | 'blocked_gt_80pct';

const P50 = new Prisma.Decimal('0.5');
const P80 = new Prisma.Decimal('0.8');

/**
 * Enforces discount thresholds vs pre-discount base.
 * &gt;50% → warning metadata; &gt;80% → non-admin blocked (admin/super_admin allowed).
 */
export function enforceDiscountPolicy(input: {
  baseTotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  role: UserRole;
}): { severity: DiscountSeverity; discountRatio: Prisma.Decimal } {
  const baseTotal = money(input.baseTotal);
  const discount = money(input.discount);
  if (baseTotal.lte(d0())) {
    return { severity: 'none', discountRatio: d0() };
  }
  const ratio = dDiv(discount, baseTotal);

  if (ratio.gt(P80)) {
    const adminOk =
      input.role === UserRole.admin || input.role === UserRole.super_admin;
    if (!adminOk) {
      throw new BadRequestException({
        message: 'خصم يتجاوز 80٪ من الأساس يتطلب حساب مسؤول',
        code: 'DISCOUNT_REQUIRES_ADMIN',
        status: 400,
      });
    }
    return { severity: 'blocked_gt_80pct', discountRatio: ratio };
  }

  if (ratio.gt(P50)) {
    return { severity: 'warn_gt_50pct', discountRatio: ratio };
  }

  return { severity: 'none', discountRatio: ratio };
}
