import { AppointmentStatus, Prisma } from '@prisma/client';
import { money } from '../utils/money';

/** Factory for appointment rows — scheduling engine composes most seeds; use for manual overrides / tests. */
export function createAppointmentRow(
  base: Prisma.AppointmentCreateManyInput,
  overrides?: Partial<Prisma.AppointmentCreateManyInput>,
): Prisma.AppointmentCreateManyInput {
  const merged = { ...base, ...overrides };
  if (!merged.status) merged.status = AppointmentStatus.scheduled;
  if (merged.discount == null) merged.discount = money(0);
  return merged;
}
