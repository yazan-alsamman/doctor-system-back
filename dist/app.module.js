"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const path_1 = require("path");
const prisma_module_1 = require("./database/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const patients_module_1 = require("./patients/patients.module");
const services_module_1 = require("./services/services.module");
const appointments_module_1 = require("./appointments/appointments.module");
const invoices_module_1 = require("./invoices/invoices.module");
const schedules_module_1 = require("./schedules/schedules.module");
const users_module_1 = require("./users/users.module");
const sessions_module_1 = require("./sessions/sessions.module");
const common_infra_module_1 = require("./common/common-infra.module");
const access_module_1 = require("./common/access/access.module");
const app_controller_1 = require("./app.controller");
const super_admin_module_1 = require("./super-admin/super-admin.module");
const notifications_module_1 = require("./notifications/notifications.module");
const ai_module_1 = require("./ai/ai.module");
const sync_module_1 = require("./sync/sync.module");
const backendEnvDir = (0, path_1.resolve)(__dirname, '..');
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: [
                    (0, path_1.resolve)(backendEnvDir, '.env.local'),
                    (0, path_1.resolve)(backendEnvDir, '.env'),
                ],
            }),
            schedule_1.ScheduleModule.forRoot(),
            prisma_module_1.PrismaModule,
            common_infra_module_1.CommonInfraModule,
            access_module_1.AccessModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            patients_module_1.PatientsModule,
            services_module_1.ServicesModule,
            appointments_module_1.AppointmentsModule,
            invoices_module_1.InvoicesModule,
            sessions_module_1.SessionsModule,
            schedules_module_1.SchedulesModule,
            super_admin_module_1.SuperAdminModule,
            notifications_module_1.NotificationsModule,
            ai_module_1.AiModule,
            sync_module_1.SyncModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map