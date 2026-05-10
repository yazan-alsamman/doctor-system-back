import { AppointmentStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

const FORWARD_FLOW: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled:       ['confirmed', 'arrived', 'no_show'],
  confirmed:       ['arrived', 'no_show'],
  arrived:         ['in_consultation'],
  in_consultation: ['completed'],
  completed:       ['paid'],
  paid:            [],
  no_show:         [],
  cancelled:       [],
};

// Only pre-service statuses allow cancellation; completed/paid appointments
// must go through a refund flow instead.
const CANCELLABLE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.scheduled,
  AppointmentStatus.confirmed,
  AppointmentStatus.arrived,
]);

export function assertValidTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): void {
  if (from === to) return;

  if (to === AppointmentStatus.cancelled) {
    if (!CANCELLABLE_STATUSES.has(from)) {
      throw new BadRequestException({
        message: `Cannot cancel an appointment that is already '${from}'. Use a refund flow instead.`,
        code: 'INVALID_APPOINTMENT_TRANSITION',
        status: 400,
      });
    }
    return;
  }

  if (!FORWARD_FLOW[from]?.includes(to)) {
    throw new BadRequestException({
      message: `Invalid appointment transition: ${from} → ${to}`,
      code: 'INVALID_APPOINTMENT_TRANSITION',
      status: 400,
    });
  }
}
