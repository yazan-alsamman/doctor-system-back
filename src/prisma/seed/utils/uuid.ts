import { createHash } from 'crypto';

/** Deterministic UUID v4-shaped IDs for reproducible bulk inserts. */
export function seededUuid(namespace: string, counter: number): string {
  const hash = createHash('sha256').update(`${namespace}:${counter}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}
