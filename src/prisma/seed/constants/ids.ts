/** Stable tenant UUID — align mediflow `.env` `VITE_TENANT_ID` with primary clinic. */
export const PRIMARY_TENANT_ID = '11111111-1111-1111-1111-111111111111';

export const PLATFORM_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/** Secondary demo clinics — multi-tenant dashboards */
export const EXTRA_TENANT_IDS = [
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
] as const;

export const ALL_SEEDED_TENANT_IDS = [PRIMARY_TENANT_ID, ...EXTRA_TENANT_IDS] as const;

export const DEFAULT_DEMO_PASSWORD = 'SyriaDemo2026!';

/** Marker embedded in appointment notes for bulk rows (debug / idempotency hints). */
export const SEED_ENGINE_MARK = 'seed:v2-engine';
