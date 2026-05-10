import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PatientsService } from './patients.service';

@Injectable()
export class PatientsScheduler {
  private readonly logger = new Logger(PatientsScheduler.name);

  constructor(private readonly patientsService: PatientsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runExpiredPackagesSweep() {
    const count = await this.patientsService.markExpiredPackages();
    if (count > 0) {
      this.logger.log(`Package expiry sweep: marked ${count} packages as expired`);
    }
  }
}
