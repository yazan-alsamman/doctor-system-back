import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoicesService } from './invoices.service';

/** Daily read-only integrity sweep — logs mismatches for ops follow-up. */
@Injectable()
export class BillingReconciliationScheduler {
  private readonly logger = new Logger(BillingReconciliationScheduler.name);

  constructor(private readonly invoicesService: InvoicesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async reconcile(): Promise<void> {
    try {
      const r = await this.invoicesService.runBillingIntegritySweep();
      if (r.paymentMismatch > 0 || r.appointmentMismatch > 0) {
        this.logger.warn(
          `Billing reconciliation: paymentSumDrift=${r.paymentMismatch} invoiceApptDrift=${r.appointmentMismatch}`,
        );
      }
    } catch (e) {
      this.logger.error(`Billing reconciliation failed: ${String(e)}`);
    }
  }
}
