import { UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
export type DiscountSeverity = 'none' | 'warn_gt_50pct' | 'blocked_gt_80pct';
export declare function enforceDiscountPolicy(input: {
    baseTotal: Prisma.Decimal;
    discount: Prisma.Decimal;
    role: UserRole;
}): {
    severity: DiscountSeverity;
    discountRatio: Prisma.Decimal;
};
