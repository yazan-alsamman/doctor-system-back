import { tenantWhere } from './tenant-prisma.helper';

describe('tenantWhere', () => {
  it('always enforces tenant and soft-delete scope', () => {
    const where = tenantWhere('tenant-1', { id: 'x1' });
    expect(where).toEqual({
      id: 'x1',
      tenantId: 'tenant-1',
      deletedAt: null,
    });
  });

  it('works without extra filters', () => {
    const where = tenantWhere('tenant-2');
    expect(where).toEqual({
      tenantId: 'tenant-2',
      deletedAt: null,
    });
  });
});
