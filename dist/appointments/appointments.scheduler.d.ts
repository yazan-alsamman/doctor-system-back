import { AppointmentsService } from './appointments.service';
export declare class AppointmentsScheduler {
    private readonly appointmentsService;
    private readonly logger;
    constructor(appointmentsService: AppointmentsService);
    runNoShowSweep(): Promise<void>;
}
