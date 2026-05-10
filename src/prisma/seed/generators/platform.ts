import * as bcrypt from 'bcrypt';
import {
  Plan,
  PrismaClient,
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from '@prisma/client';
import { PLATFORM_TENANT_ID } from '../constants/ids';

export async function ensurePlatformSuperAdmin(prisma: PrismaClient) {
  const superEmail = (process.env.SUPER_ADMIN_EMAIL || 'owner@mediflow.saas').trim().toLowerCase();
  const superPass = process.env.SUPER_ADMIN_PASSWORD || 'MediFlowSuper2026!';
  const hash = await bcrypt.hash(superPass, 10);
  await prisma.tenant.upsert({
    where: { id: PLATFORM_TENANT_ID },
    update: {
      name: 'MediFlow Platform',
      status: TenantStatus.active,
      plan: Plan.pro,
      subscriptionStatus: SubscriptionStatus.active,
      deletedAt: null,
    },
    create: {
      id: PLATFORM_TENANT_ID,
      name: 'MediFlow Platform',
      status: TenantStatus.active,
      plan: Plan.pro,
      subscriptionStatus: SubscriptionStatus.active,
    },
  });
  await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: PLATFORM_TENANT_ID, email: superEmail },
    },
    update: {
      passwordHash: hash,
      role: UserRole.super_admin,
      active: true,
      name: 'MediFlow Super Admin',
      deletedAt: null,
    },
    create: {
      tenantId: PLATFORM_TENANT_ID,
      email: superEmail,
      name: 'MediFlow Super Admin',
      passwordHash: hash,
      role: UserRole.super_admin,
      active: true,
    },
  });
  console.log('\n🔐 Super Admin (SaaS console /admin):');
  console.log(`   Email: ${superEmail}`);
  console.log('   Password: SUPER_ADMIN_PASSWORD env or default MediFlowSuper2026!');
}
