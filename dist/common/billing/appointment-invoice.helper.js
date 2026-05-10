"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickActiveInvoice = pickActiveInvoice;
function pickActiveInvoice(invoices) {
    if (!invoices?.length)
        return null;
    const open = invoices.filter((i) => i.status !== 'cancelled' && !i.deletedAt);
    if (open.length) {
        return [...open].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    }
    return [...invoices].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}
//# sourceMappingURL=appointment-invoice.helper.js.map