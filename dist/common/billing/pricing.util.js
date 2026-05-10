"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computePricing = computePricing;
const decimal_money_util_1 = require("./decimal-money.util");
function computePricing(input) {
    const baseTotal = input.servicePrices.reduce((sum, v) => sum.plus((0, decimal_money_util_1.money)(v)), (0, decimal_money_util_1.d0)());
    const rawDiscount = (0, decimal_money_util_1.dMax)((0, decimal_money_util_1.money)(input.discount), (0, decimal_money_util_1.d0)());
    const discount = (0, decimal_money_util_1.dMin)(rawDiscount, baseTotal);
    const fallbackFinal = (0, decimal_money_util_1.dMax)(baseTotal.minus(discount), (0, decimal_money_util_1.d0)());
    const finalTotal = input.manualPriceOverride !== undefined && input.manualPriceOverride !== null
        ? (0, decimal_money_util_1.dMax)((0, decimal_money_util_1.money)(input.manualPriceOverride), (0, decimal_money_util_1.d0)())
        : fallbackFinal;
    return { baseTotal, discount, finalTotal };
}
//# sourceMappingURL=pricing.util.js.map