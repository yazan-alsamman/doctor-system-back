"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BillingReconciliationScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingReconciliationScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const invoices_service_1 = require("./invoices.service");
let BillingReconciliationScheduler = BillingReconciliationScheduler_1 = class BillingReconciliationScheduler {
    invoicesService;
    logger = new common_1.Logger(BillingReconciliationScheduler_1.name);
    constructor(invoicesService) {
        this.invoicesService = invoicesService;
    }
    async reconcile() {
        try {
            const r = await this.invoicesService.runBillingIntegritySweep();
            if (r.paymentMismatch > 0 || r.appointmentMismatch > 0) {
                this.logger.warn(`Billing reconciliation: paymentSumDrift=${r.paymentMismatch} invoiceApptDrift=${r.appointmentMismatch}`);
            }
        }
        catch (e) {
            this.logger.error(`Billing reconciliation failed: ${String(e)}`);
        }
    }
};
exports.BillingReconciliationScheduler = BillingReconciliationScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_3AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BillingReconciliationScheduler.prototype, "reconcile", null);
exports.BillingReconciliationScheduler = BillingReconciliationScheduler = BillingReconciliationScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [invoices_service_1.InvoicesService])
], BillingReconciliationScheduler);
//# sourceMappingURL=billing-reconciliation.scheduler.js.map