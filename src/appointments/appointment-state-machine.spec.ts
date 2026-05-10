import { AppointmentStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { assertValidTransition } from './appointment-state-machine';

describe('appointment state machine', () => {
  it('allows valid forward transitions', () => {
    expect(() => assertValidTransition(AppointmentStatus.scheduled, AppointmentStatus.confirmed)).not.toThrow();
    expect(() => assertValidTransition(AppointmentStatus.confirmed, AppointmentStatus.arrived)).not.toThrow();
    expect(() => assertValidTransition(AppointmentStatus.arrived, AppointmentStatus.in_consultation)).not.toThrow();
    expect(() => assertValidTransition(AppointmentStatus.in_consultation, AppointmentStatus.completed)).not.toThrow();
    expect(() => assertValidTransition(AppointmentStatus.completed, AppointmentStatus.paid)).not.toThrow();
  });

  it('blocks skipping states', () => {
    expect(() =>
      assertValidTransition(AppointmentStatus.scheduled, AppointmentStatus.in_consultation),
    ).toThrow(BadRequestException);
  });

  it('allows cancellation only before service begins', () => {
    expect(() => assertValidTransition(AppointmentStatus.confirmed, AppointmentStatus.cancelled)).not.toThrow();
    expect(() => assertValidTransition(AppointmentStatus.in_consultation, AppointmentStatus.cancelled)).toThrow(
      BadRequestException,
    );
  });
});
