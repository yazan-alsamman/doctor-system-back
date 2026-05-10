"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAccessForRole = defaultAccessForRole;
exports.mergeFeatureOverrides = mergeFeatureOverrides;
exports.diffPartialAccess = diffPartialAccess;
exports.getAccessPath = getAccessPath;
const client_1 = require("@prisma/client");
function defaultAccessForRole(role) {
    switch (role) {
        case client_1.UserRole.admin:
        case client_1.UserRole.super_admin:
            return {
                dashboard: true,
                appointments: { view: true, create: true, edit: true },
                patients: { view: true, create: true, edit: true, notes: true },
                billing: { view: true, create: true, reports: true },
                inventory: true,
                reports: true,
                settings: true,
                procedures: { view: true, manage: false },
                users: { manage: true },
                aiBooking: true,
            };
        case client_1.UserRole.receptionist:
            return {
                dashboard: true,
                appointments: { view: true, create: true, edit: true },
                patients: { view: true, create: true, edit: true, notes: false },
                billing: { view: true, create: true, reports: false },
                inventory: false,
                reports: false,
                settings: true,
                procedures: { view: false, manage: false },
                users: { manage: false },
                aiBooking: true,
            };
        case client_1.UserRole.doctor:
            return {
                dashboard: true,
                appointments: { view: true, create: false, edit: false },
                patients: { view: true, create: false, edit: false, notes: true },
                billing: false,
                inventory: false,
                reports: false,
                settings: true,
                procedures: { view: true, manage: true },
                users: { manage: false },
                aiBooking: false,
            };
        default:
            return defaultAccessForRole(client_1.UserRole.receptionist);
    }
}
function deepMerge(target, src) {
    for (const k of Object.keys(src)) {
        const sv = src[k];
        const tv = target[k];
        if (sv &&
            typeof sv === 'object' &&
            !Array.isArray(sv) &&
            tv &&
            typeof tv === 'object' &&
            !Array.isArray(tv)) {
            deepMerge(tv, sv);
        }
        else {
            target[k] = sv;
        }
    }
    return target;
}
function mergeFeatureOverrides(role, overrides) {
    const base = structuredClone(defaultAccessForRole(role));
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
        return base;
    }
    const ceiling = defaultAccessForRole(role);
    const sanitized = clampOverridesToCeiling(overrides, ceiling);
    deepMerge(base, sanitized);
    return base;
}
function clampOverridesToCeiling(overrides, ceiling) {
    const out = {};
    for (const key of Object.keys(overrides)) {
        const ov = overrides[key];
        const ceil = ceiling[key];
        if (typeof ov === 'boolean' && typeof ceil === 'boolean') {
            out[key] = ov && ceil;
        }
        else if (ov &&
            typeof ov === 'object' &&
            !Array.isArray(ov) &&
            ceil &&
            typeof ceil === 'object' &&
            !Array.isArray(ceil)) {
            out[key] = clampOverridesToCeiling(ov, ceil);
        }
        else {
            out[key] = ov;
        }
    }
    return out;
}
function diffObjects(base, edited) {
    if (edited === undefined)
        return undefined;
    if (typeof base === 'boolean' && typeof edited === 'boolean') {
        return base === edited ? undefined : edited;
    }
    if (typeof base !== 'object' || base === null || Array.isArray(base)) {
        return base === edited ? undefined : edited;
    }
    if (typeof edited !== 'object' || edited === null || Array.isArray(edited)) {
        return edited;
    }
    const out = {};
    const bk = base;
    const ek = edited;
    for (const key of new Set([...Object.keys(bk), ...Object.keys(ek)])) {
        const sub = diffObjects(bk[key], ek[key]);
        if (sub !== undefined)
            out[key] = sub;
    }
    return Object.keys(out).length ? out : undefined;
}
function diffPartialAccess(role, desired) {
    const base = defaultAccessForRole(role);
    const diff = diffObjects(base, desired);
    if (diff === undefined)
        return null;
    if (typeof diff === 'object' &&
        diff !== null &&
        !Array.isArray(diff) &&
        Object.keys(diff).length === 0) {
        return null;
    }
    return diff;
}
function getAccessPath(access, dotPath) {
    const parts = dotPath.split('.');
    let cur = access;
    for (const p of parts) {
        if (cur == null || typeof cur !== 'object')
            return false;
        cur = cur[p];
    }
    return Boolean(cur);
}
//# sourceMappingURL=access-matrix.js.map