import { PatientsService } from './patients.service';
export declare class PatientsScheduler {
    private readonly patientsService;
    private readonly logger;
    constructor(patientsService: PatientsService);
    runExpiredPackagesSweep(): Promise<void>;
}
