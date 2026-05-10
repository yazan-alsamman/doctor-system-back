"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceDiscountPolicy = enforceDiscountPolicy;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const client_2 = require("@prisma/client");
const decimal_money_util_1 = require("./decimal-money.util");
const P50 = new client_2.Prisma.Decimal('0.5');
const P80 = new client_2.Prisma.Decimal('0.8');
function enforceDiscountPolicy(input) {
    const baseTotal = (0, decimal_money_util_1.money)(input.baseTotal);
    const discount = (0, decimal_money_util_1.money)(input.discount);
    if (baseTotal.lte((0, decimal_money_util_1.d0)())) {
        return { severity: 'none', discountRatio: (0, decimal_money_util_1.d0)() };
    }
    const ratio = (0, decimal_money_util_1.dDiv)(discount, baseTotal);
    if (ratio.gt(P80)) {
        const adminOk = input.role === client_1.UserRole.admin || input.role === client_1.UserRole.super_admin;
        if (!adminOk) {
            throw new common_1.BadRequestException({
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
//# sourceMappingURL=discount-policy.util.js.map