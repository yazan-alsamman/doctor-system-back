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
var PatientsScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientsScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const patients_service_1 = require("./patients.service");
let PatientsScheduler = PatientsScheduler_1 = class PatientsScheduler {
    patientsService;
    logger = new common_1.Logger(PatientsScheduler_1.name);
    constructor(patientsService) {
        this.patientsService = patientsService;
    }
    async runExpiredPackagesSweep() {
        const count = await this.patientsService.markExpiredPackages();
        if (count > 0) {
            this.logger.log(`Package expiry sweep: marked ${count} packages as expired`);
        }
    }
};
exports.PatientsScheduler = PatientsScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PatientsScheduler.prototype, "runExpiredPackagesSweep", null);
exports.PatientsScheduler = PatientsScheduler = PatientsScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [patients_service_1.PatientsService])
], PatientsScheduler);
//# sourceMappingURL=patients.scheduler.js.map