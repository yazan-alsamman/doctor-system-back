"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginSchema = void 0;
const zod_1 = require("zod");
function normalizeOptionalTenantId(v) {
    if (v === undefined || v === null)
        return undefined;
    if (typeof v !== 'string')
        return undefined;
    let t = v.replace(/\r/g, '').replace(/^\uFEFF/, '').trim();
    if (t === '')
        return undefined;
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
        t = t.slice(1, -1).trim();
    }
    if (t === '')
        return undefined;
    return zod_1.z.string().uuid().safeParse(t).success ? t : undefined;
}
const optionalTenantId = zod_1.z.preprocess(normalizeOptionalTenantId, zod_1.z.string().uuid().optional());
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().toLowerCase().pipe(zod_1.z.string().email()),
    password: zod_1.z.string().min(6),
    tenantId: optionalTenantId,
});
//# sourceMappingURL=login.dto.js.map