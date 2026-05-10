import { InvoicesService } from './invoices.service';
export declare class BillingReconciliationScheduler {
    private readonly invoicesService;
    private readonly logger;
    constructor(invoicesService: InvoicesService);
    reconcile(): Promise<void>;
}
