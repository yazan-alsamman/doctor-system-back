import type { PrismaClient } from '@prisma/client';
import { resolveSeedConfig } from './core/config';
import { DEFAULT_DEMO_PASSWORD, PRIMARY_TENANT_ID } from './constants/ids';
import { ensurePlatformSuperAdmin } from './generators/platform';
import { wipeDemoTenants } from './generators/wipe';
import { blueprintsForSeed, insertTenants } from './generators/tenant-generator';
import { seedTenantWorkload, type TenantSeedResult } from './generators/tenant-workload.generator';
import { printSeedReport } from './reports/summary';

export async function runSeedEngine(prisma: PrismaClient) {
  const config = resolveSeedConfig();

  await ensurePlatformSuperAdmin(prisma);
  await wipeDemoTenants(prisma);

  const blueprints = blueprintsForSeed(config.extraTenantCount);
  await insertTenants(prisma, blueprints);

  const results: TenantSeedResult[] = [];
  for (const bp of blueprints) {
    const isPrimary = bp.id === PRIMARY_TENANT_ID;
    const patientTarget = isPrimary
      ? config.patientsPerPrimaryTenant
      : Math.max(
          120,
          Math.floor(config.patientsPerPrimaryTenant * config.extraTenantPatientRatio),
        );
    const slug = isPrimary ? 'sham' : bp.id.replace(/-/g, '').slice(0, 10);
    results.push(
      await seedTenantWorkload(prisma, {
        tenantId: bp.id,
        tenantSlug: slug,
        config,
        patientTarget,
        useLegacyDemoEmails: isPrimary,
      }),
    );
  }

  printSeedReport(results, config);

  console.log(`كلمة المرور لجميع حسابات العيادات التجريبية: ${DEFAULT_DEMO_PASSWORD}`);
  console.log(`معرّف المستأجر الرئيسي (VITE_TENANT_ID): ${PRIMARY_TENANT_ID}`);
  console.log('حسابات رئيسية: admin@sham.com — reception@sham.com — doc1@sham.com …');
}
