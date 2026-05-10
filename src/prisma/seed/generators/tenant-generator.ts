import {
  Plan,
  PrismaClient,
  SubscriptionStatus,
  TenantStatus,
} from '@prisma/client';
import type { TenantBlueprint } from '../core/types';
import { EXTRA_TENANT_IDS, PRIMARY_TENANT_ID } from '../constants/ids';

const NAMES: Record<string, string> = {
  [PRIMARY_TENANT_ID]: 'عيادة الشام للتجميل والليزر — الرئيسي',
  [EXTRA_TENANT_IDS[0]]: 'مركز دمشق لطب الأسنان التجميلي',
  [EXTRA_TENANT_IDS[1]]: 'عيادة اللاذقية الجلدية والليزر الطبي',
  [EXTRA_TENANT_IDS[2]]: 'فرع VIP — خدمات المنزل والمواعيد السريعة',
  [EXTRA_TENANT_IDS[3]]: 'كلينيك حلب — حقن وتعبئة وبوتوكس',
};

export function blueprintsForSeed(extraCount: number): TenantBlueprint[] {
  const primary: TenantBlueprint = {
    id: PRIMARY_TENANT_ID,
    name: NAMES[PRIMARY_TENANT_ID]!,
    status: TenantStatus.active,
    plan: Plan.pro,
    subscriptionStatus: SubscriptionStatus.active,
    nextBillingDate: addMonths(new Date(), 1),
  };
  const extras = EXTRA_TENANT_IDS.slice(0, extraCount).map((id) => ({
    id,
    name: NAMES[id] || `عيادة تجريبية ${id.slice(0, 8)}`,
    status: TenantStatus.active,
    plan: id === EXTRA_TENANT_IDS[2] ? Plan.pro : Plan.basic,
    subscriptionStatus:
      id === EXTRA_TENANT_IDS[1] ? SubscriptionStatus.trial : SubscriptionStatus.active,
    nextBillingDate: addMonths(new Date(), id === EXTRA_TENANT_IDS[1] ? 0 : 2),
  }));
  return [primary, ...extras];
}

function addMonths(d: Date, m: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}

export async function insertTenants(prisma: PrismaClient, plans: TenantBlueprint[]) {
  await prisma.tenant.createMany({
    data: plans.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      plan: p.plan,
      subscriptionStatus: p.subscriptionStatus,
      nextBillingDate: p.nextBillingDate ?? null,
      invoiceSeq: 0,
    })),
    skipDuplicates: true,
  });
}
