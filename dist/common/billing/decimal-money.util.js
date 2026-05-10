"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.d0 = void 0;
exports.money = money;
exports.dSum = dSum;
exports.dEq = dEq;
exports.dGt = dGt;
exports.dGte = dGte;
exports.dLt = dLt;
exports.dLte = dLte;
exports.dMin = dMin;
exports.dMax = dMax;
exports.dClampLower = dClampLower;
exports.dDiv = dDiv;
const client_1 = require("@prisma/client");
const MONEY_EPS = new client_1.Prisma.Decimal('0.009');
const d0 = () => new client_1.Prisma.Decimal(0);
exports.d0 = d0;
function money(v) {
    if (v === null || v === undefined)
        return (0, exports.d0)();
    if (v instanceof client_1.Prisma.Decimal)
        return v;
    return new client_1.Prisma.Decimal(String(v));
}
function dSum(vals) {
    return vals.reduce((a, b) => a.plus(b), (0, exports.d0)());
}
function dEq(a, b, epsilon = MONEY_EPS) {
    return a.minus(b).abs().lte(epsilon);
}
function dGt(a, b) {
    return a.gt(b);
}
function dGte(a, b) {
    return a.gte(b);
}
function dLt(a, b) {
    return a.lt(b);
}
function dLte(a, b) {
    return a.lte(b);
}
function dMin(a, b) {
    return a.lte(b) ? a : b;
}
function dMax(a, b) {
    return a.gte(b) ? a : b;
}
function dClampLower(value, min) {
    return dMax(value, min);
}
function dDiv(a, b) {
    if (b.isZero())
        return (0, exports.d0)();
    return a.dividedBy(b);
}
//# sourceMappingURL=decimal-money.util.js.map