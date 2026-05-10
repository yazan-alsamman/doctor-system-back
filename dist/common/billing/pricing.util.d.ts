import { Prisma } from "@prisma/client";
export interface PricingDecimal {
    baseTotal: Prisma.Decimal;
    discount: Prisma.Decimal;
    finalTotal: Prisma.Decimal;
}
export declare function computePricing(input: {
    servicePrices: Array<Prisma.Decimal | string | number>;
    discount?: Prisma.Decimal | string | number | null;
    manualPriceOverride?: Prisma.Decimal | string | number | null;
}): PricingDecimal;
