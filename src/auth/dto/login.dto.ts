import { z } from 'zod';

/** Normalize client/env quirks: CRLF, wrapped quotes, BOM; drop invalid UUIDs instead of 400. */
function normalizeOptionalTenantId(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return undefined;
  let t = v.replace(/\r/g, '').replace(/^\uFEFF/, '').trim();
  if (t === '') return undefined;
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  if (t === '') return undefined;
  return z.string().uuid().safeParse(t).success ? t : undefined;
}

const optionalTenantId = z.preprocess(normalizeOptionalTenantId, z.string().uuid().optional());

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.string().email()),
  password: z.string().min(6),
  tenantId: optionalTenantId,
});

export type LoginDto = z.infer<typeof LoginSchema>;
