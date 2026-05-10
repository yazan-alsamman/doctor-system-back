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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../database/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
const audit_log_service_1 = require("../common/audit/audit-log.service");
const domain_events_service_1 = require("../common/events/domain-events.service");
const tenant_prisma_helper_1 = require("../common/tenant-prisma.helper");
const patient_format_1 = require("./patient-format");
let PatientsService = class PatientsService {
    prisma;
    notifications;
    auditLog;
    domainEvents;
    constructor(prisma, notifications, auditLog, domainEvents) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.auditLog = auditLog;
        this.domainEvents = domainEvents;
    }
    normalizeVitals(v) {
        if (v === undefined || v === null)
            return undefined;
        const hr = v.hr !== undefined ? Number(v.hr) : 72;
        const spo2 = v.spo2 !== undefined ? Number(v.spo2) : 98;
        return {
            bp: v.bp ?? '120/80',
            hr: Number.isFinite(hr) ? hr : 72,
            spo2: Number.isFinite(spo2) ? spo2 : 98,
        };
    }
    mapRecordStatus(s) {
        if (s === 'active')
            return client_1.PatientRecordStatus.active;
        if (s === 'inactive')
            return client_1.PatientRecordStatus.inactive;
        return client_1.PatientRecordStatus.new;
    }
    async toViews(auth, rows) {
        if (rows.length === 0)
            return [];
        const now = new Date();
        const ids = rows.map((p) => p.id);
        const appts = await this.prisma.appointment.findMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, {
                patientId: { in: ids },
                deletedAt: null,
            }),
            select: {
                patientId: true,
                startTime: true,
                status: true,
            },
        });
        const schedMap = (0, patient_format_1.buildScheduleForPatients)(ids, appts, now);
        return rows.map((p) => (0, patient_format_1.toPatientView)(p, schedMap.get(p.id) ?? { last: null, next: null }, now));
    }
    async list(auth, query) {
        const page = Math.max(1, Number(query?.page || 1));
        const limit = Math.min(100, Math.max(1, Number(query?.limit || 50)));
        const search = query?.q?.trim();
        const where = (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, {
            deletedAt: null,
            OR: search
                ? [
                    { name: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                ]
                : undefined,
        });
        return this.prisma.$transaction(async (tx) => {
            const [items, total] = await Promise.all([
                tx.patient.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                }),
                tx.patient.count({ where }),
            ]);
            const views = await this.toViews(auth, items);
            return {
                items: views,
                meta: {
                    page,
                    limit,
                    total,
                    pages: Math.max(1, Math.ceil(total / limit)),
                },
            };
        });
    }
    async findOne(auth, id) {
        const patient = await this.prisma.patient.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id, deletedAt: null }),
        });
        if (!patient)
            throw new common_1.NotFoundException('Patient not found');
        const [view] = await this.toViews(auth, [patient]);
        return view;
    }
    listPackages(auth, patientId) {
        return this.prisma.patientPackage.findMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { patientId }),
            include: { service: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createPackage(auth, patientId, dto) {
        const patient = await this.prisma.patient.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: patientId }),
            select: { id: true },
        });
        if (!patient)
            throw new common_1.NotFoundException('Patient not found');
        const service = await this.prisma.service.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: dto.serviceId }),
            select: { id: true, price: true },
        });
        if (!service)
            throw new common_1.NotFoundException('Service not found');
        const existingActive = await this.prisma.patientPackage.findFirst({
            where: {
                tenantId: auth.tenantId,
                patientId,
                serviceId: dto.serviceId,
                status: 'active',
                deletedAt: null,
            },
            select: { id: true },
        });
        if (existingActive) {
            throw new common_1.ConflictException({
                message: 'Patient already has an active package for this service. Complete or expire the existing package first.',
                code: 'PACKAGE_ALREADY_EXISTS',
                existingPackageId: existingActive.id,
                status: 409,
            });
        }
        return this.prisma.$transaction(async (tx) => {
            const pkg = await tx.patientPackage.create({
                data: {
                    tenantId: auth.tenantId,
                    patientId,
                    serviceId: dto.serviceId,
                    totalSessions: dto.totalSessions,
                    remainingSessions: dto.totalSessions,
                    pricePerSession: Number(service.price),
                    expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
                },
                include: { service: true },
            });
            await this.domainEvents.emitTx(tx, {
                tenantId: auth.tenantId,
                aggregateType: 'patient_package',
                aggregateId: pkg.id,
                eventType: 'PACKAGE_CREATED',
                payload: {
                    patientId,
                    serviceId: dto.serviceId,
                    totalSessions: dto.totalSessions,
                    pricePerSession: Number(service.price),
                    expiresAt: dto.expiresAt ?? null,
                },
            });
            await this.auditLog.logTx(tx, {
                tenantId: auth.tenantId,
                actorUserId: auth.userId,
                action: 'patient_package.create',
                entityType: 'patient_package',
                entityId: pkg.id,
                metadata: {
                    patientId,
                    serviceId: dto.serviceId,
                    totalSessions: dto.totalSessions,
                    pricePerSession: Number(service.price),
                    expiresAt: dto.expiresAt ?? null,
                },
            });
            return pkg;
        });
    }
    async create(auth, dto) {
        const existing = await this.prisma.patient.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { phone: dto.phone, deletedAt: null }),
        });
        if (existing) {
            throw new common_1.ConflictException({
                message: 'A patient with this phone number already exists',
                code: 'PATIENT_PHONE_CONFLICT',
                status: 409,
                existingPatientId: existing.id,
            });
        }
        const dob = dto.dob ? new Date(dto.dob) : null;
        const sex = dto.sex === 'female' ? client_1.PatientSex.female : client_1.PatientSex.male;
        const vitals = dto.vitals === null ? undefined : this.normalizeVitals(dto.vitals ?? undefined);
        const ageYears = dob ? null : dto.age === undefined || dto.age === null ? null : dto.age;
        const created = await this.prisma.patient.create({
            data: {
                tenantId: auth.tenantId,
                name: dto.name,
                phone: dto.phone,
                dob,
                notes: dto.notes ?? null,
                sex,
                bloodType: dto.bloodType ?? 'O+',
                recordStatus: this.mapRecordStatus(dto.status),
                ageYears,
                allergies: dto.allergies ?? [],
                medications: dto.medications?.length ? dto.medications : undefined,
                vitals,
            },
        });
        if (dto.quickRegistration) {
            await this.notifications.notifyUsersWithRoles(auth.tenantId, [client_1.UserRole.admin, client_1.UserRole.receptionist], client_1.NotificationSeverity.warning, `تسجيل سريع للمريض «${dto.name}» — يُرجى إكمال الملف الطبي لاحقاً.`);
        }
        const [view] = await this.toViews(auth, [created]);
        return view;
    }
    async update(auth, id, dto) {
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name;
        if (dto.phone !== undefined)
            data.phone = dto.phone;
        if (dto.notes !== undefined)
            data.notes = dto.notes;
        if (dto.sex !== undefined) {
            data.sex = dto.sex === 'female' ? client_1.PatientSex.female : client_1.PatientSex.male;
        }
        if (dto.bloodType !== undefined)
            data.bloodType = dto.bloodType;
        if (dto.status !== undefined)
            data.recordStatus = this.mapRecordStatus(dto.status);
        if (dto.dob !== undefined) {
            data.dob = dto.dob === null ? null : new Date(dto.dob);
            if (dto.dob !== null)
                data.ageYears = null;
        }
        if (dto.age !== undefined) {
            if (dto.age === null) {
                data.ageYears = null;
            }
            else {
                data.ageYears = dto.age;
                if (dto.dob === undefined)
                    data.dob = null;
            }
        }
        if (dto.allergies !== undefined) {
            data.allergies = dto.allergies ?? [];
        }
        if (dto.medications !== undefined) {
            data.medications =
                dto.medications === null || dto.medications.length === 0
                    ? client_1.Prisma.JsonNull
                    : dto.medications;
        }
        if (dto.vitals !== undefined) {
            data.vitals =
                dto.vitals === null ? client_1.Prisma.JsonNull : this.normalizeVitals(dto.vitals);
        }
        const result = await this.prisma.patient.updateMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id, deletedAt: null }),
            data,
        });
        if (result.count === 0)
            throw new common_1.NotFoundException('Patient not found');
        return this.findOne(auth, id);
    }
    remove(auth, id) {
        return this.prisma.patient.updateMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id }),
            data: { deletedAt: new Date() },
        });
    }
    async markExpiredPackages() {
        const result = await this.prisma.patientPackage.updateMany({
            where: {
                status: 'active',
                deletedAt: null,
                expiresAt: { lt: new Date() },
            },
            data: { status: 'expired' },
        });
        return result.count;
    }
};
exports.PatientsService = PatientsService;
exports.PatientsService = PatientsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService,
        audit_log_service_1.AuditLogService,
        domain_events_service_1.DomainEventsService])
], PatientsService);
//# sourceMappingURL=patients.service.js.map