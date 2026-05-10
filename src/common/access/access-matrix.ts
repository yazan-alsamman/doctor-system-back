import { UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';

/** Mirrors frontend navigation / `can()` paths — nested flags per clinic role. */
export type ClinicAccess = {
  dashboard: boolean;
  appointments: { view: boolean; create: boolean; edit: boolean };
  patients: { view: boolean; create: boolean; edit: boolean; notes: boolean };
  billing: boolean | { view: boolean; create: boolean; reports: boolean };
  inventory: boolean;
  reports: boolean;
  settings: boolean;
  procedures: { view: boolean; manage: boolean };
  users: { manage: boolean };
  aiBooking: boolean;
};

export function defaultAccessForRole(role: UserRole): ClinicAccess {
  switch (role) {
    case UserRole.admin:
    case UserRole.super_admin:
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
    case UserRole.receptionist:
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
    case UserRole.doctor:
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
      return defaultAccessForRole(UserRole.receptionist);
  }
}

function deepMerge<T extends Record<string, unknown>>(target: T, src: Record<string, unknown>): T {
  for (const k of Object.keys(src)) {
    const sv = src[k];
    const tv = target[k as keyof T] as unknown;
    if (
      sv &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      (target as Record<string, unknown>)[k] = sv;
    }
  }
  return target;
}

/**
 * Merges featureOverrides onto the role's defaults.
 * Overrides can only RESTRICT permissions — they cannot grant capabilities
 * above what the role's maximum allows. This prevents privilege escalation
 * via the featureOverrides JSON column.
 */
export function mergeFeatureOverrides(role: UserRole, overrides: unknown): ClinicAccess {
  const base = structuredClone(defaultAccessForRole(role)) as unknown as Record<string, unknown>;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return base as unknown as ClinicAccess;
  }

  // Ceiling: maximum permissions for the role (used to clamp overrides)
  const ceiling = defaultAccessForRole(role) as unknown as Record<string, unknown>;
  const sanitized = clampOverridesToCeiling(
    overrides as Record<string, unknown>,
    ceiling,
  );

  deepMerge(base, sanitized);
  return base as unknown as ClinicAccess;
}

/**
 * Recursively clamps overrides so that `true` can only replace `true` (not `false`).
 * An override that tries to set a boolean to `true` when the ceiling has `false` is ignored.
 */
function clampOverridesToCeiling(
  overrides: Record<string, unknown>,
  ceiling: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(overrides)) {
    const ov = overrides[key];
    const ceil = ceiling[key];
    if (typeof ov === 'boolean' && typeof ceil === 'boolean') {
      // Can only keep `true` if the ceiling also allows `true`
      out[key] = ov && ceil;
    } else if (
      ov &&
      typeof ov === 'object' &&
      !Array.isArray(ov) &&
      ceil &&
      typeof ceil === 'object' &&
      !Array.isArray(ceil)
    ) {
      out[key] = clampOverridesToCeiling(
        ov as Record<string, unknown>,
        ceil as Record<string, unknown>,
      );
    } else {
      out[key] = ov;
    }
  }
  return out;
}

function diffObjects(base: unknown, edited: unknown): unknown {
  if (edited === undefined) return undefined;
  if (typeof base === 'boolean' && typeof edited === 'boolean') {
    return base === edited ? undefined : edited;
  }
  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    return base === edited ? undefined : edited;
  }
  if (typeof edited !== 'object' || edited === null || Array.isArray(edited)) {
    return edited;
  }
  const out: Record<string, unknown> = {};
  const bk = base as Record<string, unknown>;
  const ek = edited as Record<string, unknown>;
  for (const key of new Set([...Object.keys(bk), ...Object.keys(ek)])) {
    const sub = diffObjects(bk[key], ek[key]);
    if (sub !== undefined) out[key] = sub;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Minimal JSON patch to apply onto role defaults to obtain `desired`. */
export function diffPartialAccess(role: UserRole, desired: ClinicAccess): Prisma.InputJsonValue | null {
  const base = defaultAccessForRole(role);
  const diff = diffObjects(base, desired);
  if (diff === undefined) return null;
  if (
    typeof diff === 'object' &&
    diff !== null &&
    !Array.isArray(diff) &&
    Object.keys(diff as object).length === 0
  ) {
    return null;
  }
  return diff as Prisma.InputJsonValue;
}

export function getAccessPath(access: ClinicAccess, dotPath: string): boolean {
  const parts = dotPath.split('.');
  let cur: unknown = access as unknown;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return false;
    cur = (cur as Record<string, unknown>)[p];
  }
  return Boolean(cur);
}
