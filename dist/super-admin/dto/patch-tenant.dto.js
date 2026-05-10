"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchTenantSchema = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
exports.PatchTenantSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(2).max(160).optional(),
    status: zod_1.z.nativeEnum(client_1.TenantStatus).optional(),
    plan: zod_1.z.nativeEnum(client_1.Plan).optional(),
    subscriptionStatus: zod_1.z.nativeEnum(client_1.SubscriptionStatus).optional(),
    nextBillingDate: zod_1.z.coerce.date().nullable().optional(),
})
    .refine((o) => Object.keys(o).length > 0, { message: 'At least one field required' });
//# sourceMappingURL=patch-tenant.dto.js.map