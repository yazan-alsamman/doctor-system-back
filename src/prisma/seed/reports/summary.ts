import type { SeedConfig } from '../core/types';
import type { TenantSeedResult } from '../generators/tenant-workload.generator';

export function printSeedReport(results: TenantSeedResult[], config: SeedConfig) {
  const totalPatients = results.reduce((s, r) => s + r.patientCount, 0);
  const totalAppts = results.reduce((s, r) => s + r.appointmentCount, 0);
  const totalInv = results.reduce((s, r) => s + r.invoiceCount, 0);
  const totalPay = results.reduce((s, r) => s + r.paymentCount, 0);

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  MediFlow Seed Engine v2 — تقرير التوليد');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  preset: ${config.scale} | seed: ${config.seed}`);
  console.log(`  historicalDays: ${config.historicalDays} | futureDays: ${config.futureDays}`);
  console.log(`  clinicLoadFactor: ${config.clinicLoadFactor} | revenueMult: ${config.revenueMultiplier}`);
  console.log('──────────────────────────────────────────────────────────');
  console.log(`  tenants: ${results.length}`);
  console.log(`  patients (sum): ${totalPatients}`);
  console.log(`  appointments (sum): ${totalAppts}`);
  console.log(`  invoices (sum): ${totalInv}`);
  console.log(`  payments (sum): ${totalPay}`);
  console.log('──────────────────────────────────────────────────────────');
  for (const r of results) {
    console.log(
      `  • ${r.tenantId.slice(0, 13)}… | مرضى ${r.patientCount} | مواعيد ${r.appointmentCount} | فواتير ${r.invoiceCount}`,
    );
  }
  console.log('══════════════════════════════════════════════════════════\n');
}
