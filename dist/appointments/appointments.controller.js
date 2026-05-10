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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const client_2 = require("@prisma/client");
const appointments_service_1 = require("./appointments.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const zod_validation_pipe_1 = require("../common/pipes/zod-validation.pipe");
const access_service_1 = require("../common/access/access.service");
const create_appointment_dto_1 = require("./dto/create-appointment.dto");
const add_appointment_media_dto_1 = require("./dto/add-appointment-media.dto");
const create_next_session_dto_1 = require("./dto/create-next-session.dto");
const finalize_session_dto_1 = require("./dto/finalize-session.dto");
const update_appointment_status_dto_1 = require("./dto/update-appointment-status.dto");
const update_appointment_dto_1 = require("./dto/update-appointment.dto");
let AppointmentsController = class AppointmentsController {
    appointmentsService;
    access;
    constructor(appointmentsService, access) {
        this.appointmentsService = appointmentsService;
        this.access = access;
    }
    list(auth, doctorId, status, from, to, page, limit) {
        return this.appointmentsService.list(auth, {
            doctorId,
            status,
            from,
            to,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
    }
    create(auth, body) {
        return (async () => {
            await this.access.assert(auth, 'appointments.create');
            return this.appointmentsService.create(auth, body);
        })();
    }
    availability(auth, doctorId, date, serviceId, durationMinutes) {
        return this.appointmentsService.availability(auth, {
            doctorId,
            date,
            serviceId,
            durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        });
    }
    findOne(auth, id) {
        return this.appointmentsService.findOne(auth, id);
    }
    update(auth, id, body) {
        return (async () => {
            if (auth.role === client_2.UserRole.admin || auth.role === client_2.UserRole.receptionist) {
                await this.access.assert(auth, 'appointments.edit');
            }
            return this.appointmentsService.update(auth, id, body);
        })();
    }
    finalizeSession(auth, id, body) {
        return this.appointmentsService.finalizeSession(auth, id, body);
    }
    requestReception(auth, id) {
        return this.appointmentsService.requestReceptionAssistance(auth, id);
    }
    createNextSession(auth, id, body) {
        return this.appointmentsService.createNextSession(auth, id, body);
    }
    addMedia(auth, id, body) {
        return this.appointmentsService.addMedia(auth, id, body);
    }
    updateStatus(auth, id, body) {
        return this.appointmentsService.updateStatus(auth, id, body);
    }
    remove(auth, id) {
        return this.appointmentsService.remove(auth, id);
    }
};
exports.AppointmentsController = AppointmentsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('doctorId')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('from')),
    __param(4, (0, common_1.Query)('to')),
    __param(5, (0, common_1.Query)('page')),
    __param(6, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_2.UserRole.admin, client_2.UserRole.receptionist),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(create_appointment_dto_1.CreateAppointmentSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('availability'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('doctorId')),
    __param(2, (0, common_1.Query)('date')),
    __param(3, (0, common_1.Query)('serviceId')),
    __param(4, (0, common_1.Query)('durationMinutes')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "availability", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(client_2.UserRole.admin, client_2.UserRole.receptionist, client_2.UserRole.doctor),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(update_appointment_dto_1.UpdateAppointmentSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/session-finalize'),
    (0, roles_decorator_1.Roles)(client_2.UserRole.admin, client_2.UserRole.doctor),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(finalize_session_dto_1.FinalizeSessionSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "finalizeSession", null);
__decorate([
    (0, common_1.Post)(':id/request-reception'),
    (0, roles_decorator_1.Roles)(client_2.UserRole.admin, client_2.UserRole.doctor),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "requestReception", null);
__decorate([
    (0, common_1.Post)(':id/next-session'),
    (0, roles_decorator_1.Roles)(client_2.UserRole.admin, client_2.UserRole.receptionist, client_2.UserRole.doctor),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(create_next_session_dto_1.CreateNextSessionSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "createNextSession", null);
__decorate([
    (0, common_1.Post)(':id/media'),
    (0, roles_decorator_1.Roles)(client_2.UserRole.admin, client_2.UserRole.receptionist, client_2.UserRole.doctor),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(add_appointment_media_dto_1.AddAppointmentMediaSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "addMedia", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Roles)(client_2.UserRole.admin, client_2.UserRole.receptionist, client_2.UserRole.doctor),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(update_appointment_status_dto_1.UpdateAppointmentStatusSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_2.UserRole.admin, client_2.UserRole.receptionist),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppointmentsController.prototype, "remove", null);
exports.AppointmentsController = AppointmentsController = __decorate([
    (0, common_1.Controller)('appointments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [appointments_service_1.AppointmentsService,
        access_service_1.AccessService])
], AppointmentsController);
//# sourceMappingURL=appointments.controller.js.map