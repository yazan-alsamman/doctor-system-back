import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppointmentsService } from './appointments.service';

@Injectable()
export class AppointmentsScheduler {
  private readonly logger = new Logger(AppointmentsScheduler.name);

  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runNoShowSweep() {
    const count = await this.appointmentsService.markNoShows(25);
    if (count > 0) {
      this.logger.log(`Auto-marked ${count} appointments as no_show`);
    }
  }
}
