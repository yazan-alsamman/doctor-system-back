import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { BillingReconciliationScheduler } from './billing-reconciliation.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [InvoicesService, BillingReconciliationScheduler],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}
