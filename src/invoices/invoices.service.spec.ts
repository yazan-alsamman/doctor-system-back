import { ConflictException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  const auth = { tenantId: 't1', userId: 'u1', role: 'admin' as const };
  const domainEvents = { emitTx: jest.fn() } as any;
  const auditLog = { logTx: jest.fn() } as any;

  it('records partial payment without marking invoice fully paid', async () => {
    const prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv-1',
          tenantId: 't1',
          appointmentId: 'apt-1',
          finalAmount: 200,
          totalPaid: 0,
          balance: 200,
          status: 'draft',
        }),
      },
      payment: {
        create: jest.fn().mockResolvedValue({ id: 'pay-1', amount: 100 }),
      },
      appointment: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb) =>
        cb({
          payment: prisma.payment,
          invoice: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            update: jest.fn().mockResolvedValue({}),
            findUnique: jest.fn().mockResolvedValue({
              id: 'inv-1',
              status: 'partial',
              balance: 100,
            }),
          },
          appointment: prisma.appointment,
        }),
      ),
    } as any;

    const service = new InvoicesService(prisma, domainEvents, auditLog, {} as any);
    const result = await service.pay(auth, 'inv-1', { paidAmount: 100 });
    expect(result.status).toBe('partial');
  });

  it('keeps pay endpoint idempotent for already-paid invoice', async () => {
    const prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv-1',
          tenantId: 't1',
          appointmentId: 'apt-1',
          finalAmount: 200,
          status: 'paid',
        }),
      },
      $transaction: jest.fn(),
    } as any;

    const service = new InvoicesService(prisma, domainEvents, auditLog, {} as any);
    await expect(service.pay(auth, 'inv-1')).rejects.toThrow(ConflictException);
  });
});
