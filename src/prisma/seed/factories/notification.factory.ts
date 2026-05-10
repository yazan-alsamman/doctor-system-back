import { NotificationSeverity, Prisma } from '@prisma/client';

export function createNotificationRow(
  base: Prisma.NotificationCreateManyInput,
  overrides?: Partial<Prisma.NotificationCreateManyInput>,
): Prisma.NotificationCreateManyInput {
  const merged = { ...base, ...overrides };
  if (!merged.type) merged.type = NotificationSeverity.info;
  if (merged.read == null) merged.read = false;
  return merged;
}
