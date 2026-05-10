import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  const auth = { tenantId: 't1', userId: 'u1', role: UserRole.admin };

  it('prevents booking when doctor schedule is missing', async () => {
    const prisma = {
      service: {
        findMany: jest.fn().mockResolvedValue([{ id: 'svc-1', durationMinutes: 30, price: 100 }]),
      },
      patient: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'd1', role: UserRole.doctor }) },
      doctorSchedule: { findFirst: jest.fn().mockResolvedValue(null) },
      appointment: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      appointmentService: {
        createMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    } as any;

    const service = new AppointmentsService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any);
    await expect(
      service.create(auth, {
        patientId: 'p1',
        doctorId: 'd1',
        serviceId: 'svc-1',
        startTime: new Date().toISOString(),
        allowOverbook: false,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('runs no-show sweep per active tenant to prevent leakage', async () => {
    const prisma = {
      tenant: {
        findMany: jest.fn().mockResolvedValue([{ id: 't1' }, { id: 't2' }]),
      },
      appointment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'a1' }, { id: 'a2' }])
          .mockResolvedValueOnce([{ id: 'a3' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      invoice: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(async (ops) => {
        if (Array.isArray(ops)) {
          for (const op of ops) await op;
        }
      }),
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any);
    const count = await service.markNoShows(25);
    expect(count).toBe(3);
    expect(prisma.appointment.findMany).toHaveBeenCalledTimes(2);
  });

  it('returns schedule-aware availability slots', async () => {
    const prisma = {
      doctorSchedule: {
        findFirst: jest.fn().mockResolvedValue({
          startTime: '09:00',
          endTime: '12:00',
          breakStart: '10:00',
          breakEnd: '10:30',
        }),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1',
            startTime: new Date('2026-05-05T09:30:00.000Z'),
            endTime: new Date('2026-05-05T10:00:00.000Z'),
          },
        ]),
      },
      service: {
        findFirst: jest.fn().mockResolvedValue({ durationMinutes: 30 }),
      },
    } as any;
    const service = new AppointmentsService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any);
    const result = await service.availability(auth, {
      doctorId: 'd1',
      date: '2026-05-05',
      serviceId: 'svc-1',
    });
    expect(result.availableSlots).toContain('09:00');
    expect(result.unavailableSlots).toContain('09:15');
    expect(result.unavailableSlots).toContain('09:30');
    expect(result.unavailableSlots).toContain('10:00');
  });
});
