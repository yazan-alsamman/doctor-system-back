import {
  PackageStatus,
  Prisma,
  PrismaClient,
  SessionStatus,
  UserRole,
} from '@prisma/client';
import type { SeedConfig } from '../core/types';
import { createRng } from '../core/rng';
import { DEFAULT_DEMO_PASSWORD } from '../constants/ids';
import {
  createDoctorUser,
  createStaffUser,
  hashPassword,
  pickDoctorTitle,
  synthesizeDoctorWorkload,
} from '../factories/user.factory';
import { createPatientRow, synthesizeBehavior } from '../factories/patient.factory';
import { createServiceRow } from '../factories/service.factory';
import { buildServiceTemplates } from '../data/service-catalog';
import { composeArabicName } from '../data/arabic-names';
import { chunksOf } from '../utils/batch';
import { seededUuid } from '../utils/uuid';
import {
  simulateAppointments,
  type ScheduleRow,
  type SimDoctor,
  type SimPatient,
  type SimService,
} from './scheduling-engine';
import { buildFinancialPlan } from './financial-engine';
import { seedAuditAndDomainEvents, seedNotificationsForTenant } from './notifications-audit.generator';

export interface TenantSeedResult {
  tenantId: string;
  patientCount: number;
  appointmentCount: number;
  invoiceCount: number;
  paymentCount: number;
}

function specialtyForDoctorIndex(i: number, total: number): 'derma' | 'dental' | 'injector' {
  const third = Math.ceil(total / 3);
  if (i < third) return 'derma';
  if (i < third * 2) return 'dental';
  return 'injector';
}

function doctorMatchesCategory(spec: 'derma' | 'dental' | 'injector', category: string): boolean {
  const c = category.toLowerCase();
  if (spec === 'dental') {
    return ['dental', 'whitening', 'veneers'].some((k) => c.includes(k));
  }
  if (spec === 'injector') {
    return ['injectables', 'fillers', 'prp', 'surgery_consult'].some((k) => c.includes(k));
  }
  return ['laser', 'skincare', 'hydrafacial', 'hair', 'general'].some((k) => c.includes(k));
}

export async function seedTenantWorkload(
  prisma: PrismaClient,
  args: {
    tenantId: string;
    tenantSlug: string;
    config: SeedConfig;
    patientTarget: number;
    useLegacyDemoEmails: boolean;
  },
): Promise<TenantSeedResult> {
  const { tenantId, tenantSlug, config, patientTarget, useLegacyDemoEmails } = args;
  const rng = createRng(config.seed + tenantSlug.length * 1315423911 + tenantId.charCodeAt(0));
  const passwordHash = await hashPassword(DEFAULT_DEMO_PASSWORD);

  const doctorCount = config.doctors;
  const users: Prisma.UserCreateManyInput[] = [];

  const adminId = seededUuid(`usr:${tenantId}:admin`, 0);
  users.push({
    id: adminId,
    ...createStaffUser({
      tenantId,
      email: useLegacyDemoEmails ? 'admin@sham.com' : `admin.${tenantSlug}@demo.mediflow.local`,
      name: useLegacyDemoEmails ? 'أحمد الحلبي' : `مدير عيادة ${tenantSlug}`,
      role: UserRole.admin,
      passwordHash,
      title: 'مدير النظام',
    }),
  });

  users.push({
    id: seededUuid(`usr:${tenantId}:acct`, 1),
    ...createStaffUser({
      tenantId,
      email: useLegacyDemoEmails ? 'finance@sham.com' : `finance.${tenantSlug}@demo.mediflow.local`,
      name: 'ليان المحاسبة',
      role: UserRole.admin,
      passwordHash,
      title: 'محاسب العيادة',
    }),
  });

  const recId = seededUuid(`usr:${tenantId}:rec`, 2);
  users.push({
    id: recId,
    ...createStaffUser({
      tenantId,
      email: useLegacyDemoEmails ? 'reception@sham.com' : `desk.${tenantSlug}@demo.mediflow.local`,
      name: useLegacyDemoEmails ? 'سارة حموي' : `استقبال ${tenantSlug}`,
      role: UserRole.receptionist,
      passwordHash,
    }),
  });

  users.push({
    id: seededUuid(`usr:${tenantId}:asst`, 3),
    ...createStaffUser({
      tenantId,
      email: useLegacyDemoEmails ? 'assistant@sham.com' : `assist.${tenantSlug}@demo.mediflow.local`,
      name: 'مروان العجلاني',
      role: UserRole.receptionist,
      passwordHash,
      title: 'مساعد طبيب',
    }),
  });

  const doctorActors: {
    id: string;
    workload: ReturnType<typeof synthesizeDoctorWorkload>;
    spec: ReturnType<typeof specialtyForDoctorIndex>;
  }[] = [];

  const legacyDocEmails = ['doc1@sham.com', 'doc2@sham.com', 'doc3@sham.com'];
  for (let i = 0; i < doctorCount; i++) {
    const id = seededUuid(`usr:${tenantId}:doc`, i);
    const spec = specialtyForDoctorIndex(i, doctorCount);
    const workload = synthesizeDoctorWorkload(rng);
    doctorActors.push({ id, workload, spec });
    const email =
      useLegacyDemoEmails && legacyDocEmails[i]
        ? legacyDocEmails[i]!
        : `doc${i + 1}.${tenantSlug}@demo.mediflow.local`;
    const sex = rng.bernoulli(0.38) ? 'female' : 'male';
    const docPersonal = composeArabicName(rng, sex);
    users.push({
      id,
      ...createDoctorUser({
        tenantId,
        email,
        name: `د. ${docPersonal}`,
        code: `DR${String(i + 1).padStart(3, '0')}`,
        passwordHash,
        title: pickDoctorTitle(rng),
      }),
    });
  }

  await prisma.user.createMany({ data: users });

  const templates = buildServiceTemplates();
  const serviceRows: Prisma.ServiceCreateManyInput[] = [];
  let svcIdx = 0;
  for (const doc of doctorActors) {
    const tpls = templates.filter((t) => doctorMatchesCategory(doc.spec, t.category));
    const chosen = tpls.length ? tpls : templates;
    for (const tpl of chosen) {
      serviceRows.push(
        createServiceRow({
          tenantId,
          tpl,
          doctorId: doc.id,
          revenueMultiplier: config.revenueMultiplier,
          overrides: { id: seededUuid(`svc:${tenantId}`, svcIdx++) },
        }),
      );
    }
  }
  await prisma.service.createMany({ data: serviceRows });

  const schedules: ScheduleRow[] = [];
  for (const doc of doctorActors) {
    const lateStart = rng.bernoulli(0.22);
    const shortThu = rng.bernoulli(0.12);
    for (let dow = 0; dow <= 6; dow++) {
      if (dow === 5) continue;
      const start = lateStart && dow !== 6 ? '10:00' : '09:00';
      const end = shortThu && dow === 4 ? '15:30' : '18:00';
      const lunchEarly = rng.bernoulli(0.35);
      schedules.push({
        doctorId: doc.id,
        dayOfWeek: dow,
        startTime: start,
        endTime: end,
        breakStart: lunchEarly ? '12:30' : '13:00',
        breakEnd: lunchEarly ? '13:15' : '14:00',
      });
    }
  }
  await prisma.doctorSchedule.createMany({
    data: schedules.map((s) => ({
      tenantId,
      doctorId: s.doctorId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      breakStart: s.breakStart,
      breakEnd: s.breakEnd,
    })),
  });

  const patientRows: Prisma.PatientCreateManyInput[] = [];
  const simPatients: SimPatient[] = [];
  for (let i = 0; i < patientTarget; i++) {
    const id = seededUuid(`pat:${tenantId}`, i);
    const fork = createRng(config.seed + i * 977 + tenantSlug.length);
    const behavior = synthesizeBehavior(fork);
    patientRows.push(
      createPatientRow({
        tenantId,
        index: i,
        rng: fork,
        id,
        behavior,
      }),
    );
    simPatients.push({ id, behavior });
  }
  for (const chunk of chunksOf(patientRows, 800)) {
    await prisma.patient.createMany({ data: chunk });
  }

  const svcRecords = await prisma.service.findMany({
    where: { tenantId },
    select: {
      id: true,
      doctorId: true,
      durationMinutes: true,
      price: true,
      category: true,
      name: true,
    },
  });
  const tplByName = new Map(buildServiceTemplates().map((t) => [t.name, t]));
  const simServices: SimService[] = svcRecords.map((s) => {
    const tpl = tplByName.get(s.name);
    return {
      id: s.id,
      doctorId: s.doctorId!,
      durationMinutes: s.durationMinutes,
      price: s.price,
      category: s.category,
      popularity: tpl?.popularity ?? 0.55,
    };
  });

  const simDoctors: SimDoctor[] = doctorActors.map((d) => ({
    id: d.id,
    workload: d.workload,
  }));

  const blocked = new Set<string>();
  if (doctorActors.length > 2) {
    const vacDoc = doctorActors[doctorActors.length - 1]!;
    for (let k = -5; k <= 5; k++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + k);
      blocked.add(`${vacDoc.id}|${d.toISOString().slice(0, 10)}`);
    }
  }

  const built = simulateAppointments({
    tenantId,
    tenantSlug,
    rng,
    config,
    anchor: new Date(),
    doctors: simDoctors,
    services: simServices,
    schedules,
    patients: simPatients,
    apptCounterStart: 0,
    blockedDoctorDays: blocked,
  });

  for (const chunk of chunksOf(
    built.map((b) => b.row),
    500,
  )) {
    await prisma.appointment.createMany({ data: chunk });
  }

  const tenantRow = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { invoiceSeq: true },
  });
  const fin = buildFinancialPlan({
    tenantId,
    built,
    rng,
    revenueJitter: config.realisticMode ? 1 : 0.5,
    invoiceSeqStart: tenantRow.invoiceSeq,
  });

  if (fin.invoices.length) {
    for (const chunk of chunksOf(fin.invoices, 400)) {
      await prisma.invoice.createMany({ data: chunk });
    }
  }
  if (fin.payments.length) {
    for (const chunk of chunksOf(fin.payments, 500)) {
      await prisma.payment.createMany({ data: chunk });
    }
  }
  if (fin.refunds.length) {
    await prisma.refund.createMany({ data: fin.refunds });
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { invoiceSeq: tenantRow.invoiceSeq + fin.nextInvoiceSeqOffset },
  });

  const inProg = built.filter((b) => b.row.status === 'in_consultation').slice(0, 3);
  for (const b of inProg) {
    await prisma.session.create({
      data: {
        tenantId,
        appointmentId: b.row.id as string,
        patientId: b.row.patientId as string,
        doctorId: b.row.doctorId as string,
        status: SessionStatus.in_progress,
        consentObtained: rng.bernoulli(0.55),
        treatmentDetails: rng.pick([
          'معاينة أولية — تحضير للإجراء',
          'جلسة قيد التنفيذ — متابعة تجميلية',
          'تقييم ما بعد الليزر',
        ]),
      },
    });
  }

  const pkgRows: Prisma.PatientPackageCreateManyInput[] = [];
  const pkgCount = Math.min(220, Math.floor(patientTarget * 0.045));
  for (let i = 0; i < pkgCount; i++) {
    const p = rng.pick(simPatients);
    const s = rng.pick(svcRecords);
    const total = rng.nextInt(3, 10);
    const rem = rng.nextInt(0, total);
    pkgRows.push({
      tenantId,
      patientId: p.id,
      serviceId: s.id,
      totalSessions: total,
      remainingSessions: rem,
      pricePerSession: s.price,
      status:
        rem === 0 ? PackageStatus.completed : rng.bernoulli(0.06) ? PackageStatus.expired : PackageStatus.active,
      expiresAt: rng.bernoulli(0.4) ? new Date(Date.now() + rng.nextInt(10, 120) * 86400000) : null,
    });
  }
  if (pkgRows.length) await prisma.patientPackage.createMany({ data: pkgRows });

  await seedNotificationsForTenant(
    prisma,
    tenantId,
    rng,
    adminId,
    recId,
    doctorActors.map((d) => d.id),
    simPatients,
  );
  await seedAuditAndDomainEvents(
    prisma,
    tenantId,
    rng,
    adminId,
    recId,
    doctorActors[0]?.id,
    built.length,
  );

  return {
    tenantId,
    patientCount: patientTarget,
    appointmentCount: built.length,
    invoiceCount: fin.invoices.length,
    paymentCount: fin.payments.length,
  };
}
