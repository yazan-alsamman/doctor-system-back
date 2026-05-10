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
var AppointmentsScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentsScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const appointments_service_1 = require("./appointments.service");
let AppointmentsScheduler = AppointmentsScheduler_1 = class AppointmentsScheduler {
    appointmentsService;
    logger = new common_1.Logger(AppointmentsScheduler_1.name);
    constructor(appointmentsService) {
        this.appointmentsService = appointmentsService;
    }
    async runNoShowSweep() {
        const count = await this.appointmentsService.markNoShows(25);
        if (count > 0) {
            this.logger.log(`Auto-marked ${count} appointments as no_show`);
        }
    }
};
exports.AppointmentsScheduler = AppointmentsScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppointmentsScheduler.prototype, "runNoShowSweep", null);
exports.AppointmentsScheduler = AppointmentsScheduler = AppointmentsScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [appointments_service_1.AppointmentsService])
], AppointmentsScheduler);
//# sourceMappingURL=appointments.scheduler.js.map