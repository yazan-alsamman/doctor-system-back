"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonInfraModule = void 0;
const common_1 = require("@nestjs/common");
const domain_events_service_1 = require("./events/domain-events.service");
const audit_log_service_1 = require("./audit/audit-log.service");
let CommonInfraModule = class CommonInfraModule {
};
exports.CommonInfraModule = CommonInfraModule;
exports.CommonInfraModule = CommonInfraModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [domain_events_service_1.DomainEventsService, audit_log_service_1.AuditLogService],
        exports: [domain_events_service_1.DomainEventsService, audit_log_service_1.AuditLogService],
    })
], CommonInfraModule);
//# sourceMappingURL=common-infra.module.js.map