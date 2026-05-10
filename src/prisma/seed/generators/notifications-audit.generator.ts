import { NotificationSeverity, Prisma, PrismaClient } from '@prisma/client';
import type { Rng } from '../core/rng';
import { BOOKING_PHRASES_AR } from '../data/service-catalog';
import { chunksOf } from '../utils/batch';
import { seededUuid } from '../utils/uuid';
import type { SimPatient } from './scheduling-engine';

export async function seedNotificationsForTenant(
  prisma: PrismaClient,
  tenantId: string,
  rng: Rng,
  adminId: string,
  recId: string,
  doctorIds: string[],
  patients: SimPatient[],
) {
  const rows: Prisma.NotificationCreateManyInput[] = [];
  const n = Math.min(140, 35 + doctorIds.length * 12);
  for (let i = 0; i < n; i++) {
    const userId = rng.pick([adminId, recId, ...doctorIds]);
    const sev = rng.pick([
      NotificationSeverity.info,
      NotificationSeverity.info,
      NotificationSeverity.warning,
      NotificationSeverity.critical,
    ]);
    const tag = patients.length ? rng.pick(patients).id.slice(0, 8) : 'patient';
    const templates = [
      `تذكير موعد غداً — ${tag}`,
      `تأخر الطبيب — مراجعة الطابور (${tag})`,
      `فاتورة غير مسددة — ${tag}`,
      `باقة علاجية قاربت على الانتهاء — ${tag}`,
      `اقتراح حجز ذكي AI — ${tag}`,
      'ضغط مواعيد مرتفع اليوم — مراجعة الاستقبال',
      `مريض VIP وصل مبكراً — ${tag}`,
      'تنبيه ازدواجية حجز محتملة',
    ];
    rows.push({
      tenantId,
      userId,
      type: sev,
      message: rng.pick(templates),
      read: rng.bernoulli(0.35),
      createdAt: new Date(Date.now() - rng.nextInt(0, 86400000 * 40)),
    });
  }
  for (const chunk of chunksOf(rows, 500)) {
    await prisma.notification.createMany({ data: chunk });
  }
}

export async function seedAuditAndDomainEvents(
  prisma: PrismaClient,
  tenantId: string,
  rng: Rng,
  adminId: string,
  recId: string,
  doctorId: string | undefined,
  apptVolume: number,
) {
  const audits: Prisma.AuditLogCreateManyInput[] = [];
  const events: Prisma.DomainEventCreateManyInput[] = [];
  const volume = Math.min(8000, 400 + Math.floor(apptVolume * 1.2));

  const actions = [
    'LOGIN_SUCCESS',
    'PATIENT_UPDATED',
    'APPOINTMENT_CANCELLED',
    'PAYMENT_CREATED',
    'REFUND_APPROVED',
    'SCHEDULE_UPDATED',
    'ROLE_CHANGED',
    'INVOICE_ISSUED',
  ];

  const actors = [adminId, recId, doctorId].filter(Boolean) as string[];

  for (let i = 0; i < volume; i++) {
    const actor = rng.pick(actors);
    const action = rng.pick(actions);
    audits.push({
      tenantId,
      actorUserId: actor,
      action,
      entityType: rng.pick(['Patient', 'Appointment', 'Invoice', 'User', 'Payment']),
      entityId: seededUuid(`entity:${tenantId}`, i),
      metadata: {
        ip: `185.${rng.nextInt(10, 250)}.${rng.nextInt(1, 255)}.${rng.nextInt(1, 255)}`,
        ua: 'MediFlow-SeedEngine/2',
      },
      createdAt: new Date(Date.now() - rng.nextInt(0, 86400000 * 200)),
    });
  }

  const evTypes = [
    'appointment.confirmed',
    'appointment.cancelled',
    'invoice.paid',
    'patient.updated',
    'ai.booking.suggestion',
  ];
  for (let i = 0; i < Math.min(2500, Math.floor(volume / 3)); i++) {
    events.push({
      tenantId,
      aggregateType: rng.pick(['Appointment', 'Invoice', 'Patient']),
      aggregateId: seededUuid(`agg:${tenantId}`, i),
      eventType: rng.pick(evTypes),
      payload: {
        phrase: rng.pick(BOOKING_PHRASES_AR),
        score: rng.next(),
      },
      createdAt: new Date(Date.now() - rng.nextInt(0, 86400000 * 180)),
    });
  }

  for (const chunk of chunksOf(audits, 600)) {
    await prisma.auditLog.createMany({ data: chunk });
  }
  for (const chunk of chunksOf(events, 600)) {
    await prisma.domainEvent.createMany({ data: chunk });
  }
}
