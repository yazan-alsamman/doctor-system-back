import { Module } from '@nestjs/common';
import { SessionLifecycleService } from './session-lifecycle.service';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [InvoicesModule],
  providers: [SessionLifecycleService],
  exports: [SessionLifecycleService],
})
export class SessionsModule {}
