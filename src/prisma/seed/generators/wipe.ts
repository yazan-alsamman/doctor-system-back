import type { PrismaClient } from '@prisma/client';
import { ALL_SEEDED_TENANT_IDS } from '../constants/ids';

export async function wipeDemoTenants(prisma: PrismaClient, tenantIds: readonly string[] = ALL_SEEDED_TENANT_IDS) {
  for (const tenantId of tenantIds) {
    await prisma.refund.deleteMany({ where: { tenantId } });
    await prisma.payment.deleteMany({ where: { tenantId } });
    await prisma.invoice.deleteMany({ where: { tenantId } });
    await prisma.session.deleteMany({ where: { tenantId } });
    await prisma.appointmentMedia.deleteMany({ where: { tenantId } });
    await prisma.appointmentService.deleteMany({
      where: { appointment: { tenantId } },
    });
    await prisma.appointment.deleteMany({ where: { tenantId } });
    await prisma.patientPackage.deleteMany({ where: { tenantId } });
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.doctorSchedule.deleteMany({ where: { tenantId } });
    await prisma.service.deleteMany({ where: { tenantId } });
    await prisma.patient.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.domainEvent.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.idempotencyRecord.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  }
}
