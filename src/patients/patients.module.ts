import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PatientsScheduler } from './patients.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientsScheduler],
  exports: [PatientsService],
})
export class PatientsModule {}
