import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';
import { PatientsModule } from '../patients/patients.module';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [IdempotencyModule, PatientsModule, AppointmentsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
