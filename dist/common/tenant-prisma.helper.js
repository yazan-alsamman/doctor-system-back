"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantWhere = tenantWhere;
function tenantWhere(tenantId, where) {
    return {
        ...(where || {}),
        tenantId,
        deletedAt: null,
    };
}
//# sourceMappingURL=tenant-prisma.helper.js.map