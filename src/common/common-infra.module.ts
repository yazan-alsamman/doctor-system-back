import { Global, Module } from '@nestjs/common';
import { DomainEventsService } from './events/domain-events.service';
import { AuditLogService } from './audit/audit-log.service';

@Global()
@Module({
  providers: [DomainEventsService, AuditLogService],
  exports: [DomainEventsService, AuditLogService],
})
export class CommonInfraModule {}
