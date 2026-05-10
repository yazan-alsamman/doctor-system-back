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
var ToolRegistryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistryService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma.service");
const tenant_prisma_helper_1 = require("../../../common/tenant-prisma.helper");
const copilot_authorization_service_1 = require("../v2/copilot-authorization.service");
const copilot_policy_service_1 = require("../v2/copilot-policy.service");
const search_tool_args_1 = require("../v2/search-tool-args");
let ToolRegistryService = ToolRegistryService_1 = class ToolRegistryService {
    prisma;
    policy;
    authz;
    logger = new common_1.Logger(ToolRegistryService_1.name);
    constructor(prisma, policy, authz) {
        this.prisma = prisma;
        this.policy = policy;
        this.authz = authz;
    }
    async executeForIntent(intent, auth, params) {
        const tools = this.selectTools(intent, params);
        if (tools.length === 0)
            return [];
        const settled = await Promise.allSettled(tools.map(async (name) => {
            const data = await this.run(name, auth, params);
            return { tool: name, data };
        }));
        return settled.map((result, i) => {
            if (result.status === 'fulfilled')
                return result.value;
            this.logger.warn(`Tool ${tools[i]} failed: ${String(result.reason).slice(0, 200)}`);
            return { tool: tools[i], data: null, error: 'tool_failed' };
        });
    }
    selectTools(intent, params) {
        switch (intent) {
            case 'scheduling': {
                const isListing = Boolean(params.isListingQuery) ||
                    /كم|عدد|قائمة|اعرض|أظهر|ما مواعيد|list|show|how many|count/i.test(String(params.searchQuery ?? ''));
                if (isListing) {
                    return ['searchAppointments'];
                }
                return params.doctorId
                    ? ['getDoctorSchedule', 'getAvailableSlots', 'detectConflicts']
                    : ['getAvailableSlots'];
            }
            case 'clinical':
                return params.patientId
                    ? ['getPatientHistory', 'getPatientSummary']
                    : [];
            case 'finance':
                return ['getInvoiceData', 'getRevenueStats'];
            case 'communication':
                return params.patientId ? ['getPatientHistory'] : [];
            case 'search':
                return this.selectSearchTools(params);
            default:
                return [];
        }
    }
    getSearchToolsForFallbackParams(params) {
        return this.selectSearchTools(params);
    }
    finalizeSearchParams(name, params) {
        if (!(0, search_tool_args_1.isSearchToolName)(name))
            return params;
        return (0, search_tool_args_1.assertSearchExecutionArgs)(name, params);
    }
    selectSearchTools(params) {
        const q = String(params.searchQuery ?? params.q ?? '').toLowerCase();
        if (/patient|مريض|مرضى/.test(q))
            return ['searchPatients'];
        if (/invoice|فاتورة|فواتير|دفع|مدفوع|مبلغ/.test(q))
            return ['searchInvoices'];
        if (/appointment|موعد|مواعيد/.test(q))
            return ['searchAppointments'];
        return ['searchPatients', 'searchAppointments'];
    }
    async executeTool(name, auth, params) {
        try {
            const data = await this.run(name, auth, params);
            return { tool: name, data };
        }
        catch (err) {
            this.logger.warn(`executeTool ${name} failed: ${String(err).slice(0, 200)}`);
            return { tool: name, data: null, error: 'tool_failed' };
        }
    }
    async run(name, auth, params) {
        if (!this.policy.allowedTools(auth.role).has(name)) {
            this.logger.debug(`Tool ${name} blocked for role ${auth.role}`);
            return null;
        }
        let effectiveParams = params;
        if ((0, search_tool_args_1.isSearchToolName)(name)) {
            effectiveParams = this.finalizeSearchParams(name, params);
        }
        const scoped = await this.applyScopedParams(name, auth, effectiveParams);
        if (scoped === null)
            return null;
        switch (name) {
            case 'getAvailableSlots':
                return this.getAvailableSlots(auth, scoped);
            case 'getDoctorSchedule':
                return this.getDoctorSchedule(auth, scoped);
            case 'detectConflicts':
                return this.detectConflicts(auth, scoped);
            case 'getPatientHistory':
                return this.getPatientHistory(auth, scoped);
            case 'getPatientSummary':
                return this.getPatientSummary(auth, scoped);
            case 'getInvoiceData':
                return this.getInvoiceData(auth, scoped);
            case 'getRevenueStats':
                return this.getRevenueStats(auth, scoped);
            case 'generateWhatsAppMessage':
                return null;
            case 'searchAppointments':
                return this.searchAppointments(auth, scoped);
            case 'searchPatients':
                return this.searchPatients(auth, scoped);
            case 'searchInvoices':
                return this.searchInvoices(auth, scoped);
        }
    }
    async applyScopedParams(tool, auth, params) {
        let next = { ...params };
        if (next.doctorId != null && String(next.doctorId).trim() !== '') {
            const d = this.authz.parseUuid(next.doctorId);
            if (!d)
                return null;
            next = { ...next, doctorId: d };
        }
        if (next.patientId != null && String(next.patientId).trim() !== '') {
            const p = this.authz.parseUuid(next.patientId);
            if (!p)
                return null;
            next = { ...next, patientId: p };
        }
        switch (tool) {
            case 'getAvailableSlots':
            case 'getDoctorSchedule':
            case 'searchAppointments': {
                const requested = next.doctorId !== undefined && next.doctorId !== null
                    ? String(next.doctorId)
                    : undefined;
                const resolved = await this.authz.resolveDoctorId(auth, requested);
                if (resolved === null)
                    return null;
                if (resolved !== undefined) {
                    next = { ...next, doctorId: resolved };
                }
                else {
                    const { doctorId: _, ...rest } = next;
                    next = rest;
                }
                return next;
            }
            case 'getPatientHistory':
            case 'getPatientSummary': {
                const pid = this.authz.parseUuid(next.patientId);
                if (!pid)
                    return null;
                const ok = await this.authz.canReadClinicalPatient(auth, pid);
                if (!ok)
                    return null;
                return { ...next, patientId: pid };
            }
            default:
                return next;
        }
    }
    async getAvailableSlots(auth, params) {
        const from = params.from ? new Date(String(params.from)) : new Date();
        const to = new Date(from);
        to.setDate(to.getDate() + 7);
        const [schedules, bookedSlots] = await Promise.all([
            this.prisma.doctorSchedule.findMany({
                where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, {
                    doctorId: params.doctorId ? String(params.doctorId) : undefined,
                    deletedAt: null,
                }),
                include: {
                    doctor: { select: { id: true, name: true, title: true } },
                },
                orderBy: [{ doctorId: 'asc' }, { dayOfWeek: 'asc' }],
            }),
            this.prisma.appointment.findMany({
                where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, {
                    doctorId: params.doctorId ? String(params.doctorId) : undefined,
                    startTime: { gte: from, lte: to },
                    deletedAt: null,
                    status: { notIn: [client_1.AppointmentStatus.cancelled, client_1.AppointmentStatus.no_show] },
                }),
                select: {
                    doctorId: true,
                    startTime: true,
                    endTime: true,
                    status: true,
                    overbooked: true,
                },
            }),
        ]);
        return { schedules, bookedSlots, rangeStart: from, rangeEnd: to };
    }
    getDoctorSchedule(auth, params) {
        return this.prisma.doctorSchedule.findMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, {
                doctorId: params.doctorId ? String(params.doctorId) : undefined,
                deletedAt: null,
            }),
            include: {
                doctor: { select: { id: true, name: true, title: true } },
            },
            orderBy: [{ doctorId: 'asc' }, { dayOfWeek: 'asc' }],
        });
    }
    async detectConflicts(auth, params) {
        const from = params.from ? new Date(String(params.from)) : new Date();
        const to = new Date(from);
        to.setDate(to.getDate() + 1);
        return this.prisma.appointment.findMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, {
                startTime: { gte: from, lte: to },
                overbooked: true,
                deletedAt: null,
                ...(auth.role === client_1.UserRole.doctor ? { doctorId: auth.userId } : {}),
            }),
            include: {
                patient: { select: { name: true } },
                doctor: { select: { name: true } },
                service: { select: { name: true } },
            },
            orderBy: { startTime: 'asc' },
        });
    }
    async getPatientHistory(auth, params) {
        const patientId = params.patientId ? String(params.patientId) : undefined;
        if (!patientId)
            return null;
        const appointmentWhere = auth.role === client_1.UserRole.doctor
            ? { patientId, doctorId: auth.userId, deletedAt: null }
            : { patientId, deletedAt: null };
        const invoicesPromise = auth.role === client_1.UserRole.doctor
            ? Promise.resolve([])
            : this.prisma.invoice.findMany({
                where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { patientId }),
                select: {
                    status: true,
                    totalAmount: true,
                    finalAmount: true,
                    balance: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            });
        const [patient, appointments, invoices] = await Promise.all([
            this.prisma.patient.findFirst({
                where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: patientId }),
            }),
            this.prisma.appointment.findMany({
                where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, appointmentWhere),
                include: {
                    doctor: { select: { name: true, title: true } },
                    service: { select: { name: true } },
                },
                orderBy: { startTime: 'desc' },
                take: 20,
            }),
            invoicesPromise,
        ]);
        return { patient, appointments, invoices };
    }
    getPatientSummary(auth, params) {
        const patientId = params.patientId ? String(params.patientId) : undefined;
        if (!patientId)
            return Promise.resolve(null);
        return this.prisma.patient.findFirst({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, { id: patientId }),
            include: {
                appointments: {
                    where: {
                        deletedAt: null,
                        ...(auth.role === client_1.UserRole.doctor ? { doctorId: auth.userId } : {}),
                    },
                    orderBy: { startTime: 'desc' },
                    take: 5,
                    include: {
                        doctor: { select: { name: true } },
                        service: { select: { name: true } },
                    },
                },
            },
        });
    }
    getInvoiceData(auth, params) {
        const from = params.from
            ? new Date(String(params.from))
            : (() => { const d = new Date(); d.setDate(1); return d; })();
        const to = params.to ? new Date(String(params.to)) : new Date();
        return this.prisma.invoice.findMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, {
                status: params.status || undefined,
                createdAt: { gte: from, lte: to },
            }),
            include: {
                patient: { select: { name: true, phone: true } },
                payments: { select: { amount: true, method: true, createdAt: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
    async getRevenueStats(auth, params) {
        const from = params.from
            ? new Date(String(params.from))
            : (() => { const d = new Date(); d.setDate(1); return d; })();
        const to = params.to ? new Date(String(params.to)) : new Date();
        const [invoiceGroups, appointmentGroups] = await Promise.all([
            this.prisma.invoice.groupBy({
                by: ['status'],
                where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, {
                    createdAt: { gte: from, lte: to },
                }),
                _count: { _all: true },
                _sum: { totalAmount: true, finalAmount: true, totalPaid: true, balance: true },
            }),
            this.prisma.appointment.groupBy({
                by: ['status'],
                where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, {
                    startTime: { gte: from, lte: to },
                }),
                _count: { _all: true },
            }),
        ]);
        return { invoiceStats: invoiceGroups, appointmentStats: appointmentGroups, period: { from, to } };
    }
    searchPatients(auth, params) {
        const q = String(params.q ?? params.name ?? params.searchQuery ?? '').trim();
        const nameOrPhone = q
            ? {
                OR: [
                    { name: { contains: q, mode: client_1.Prisma.QueryMode.insensitive } },
                    { phone: { contains: q, mode: client_1.Prisma.QueryMode.insensitive } },
                ],
            }
            : undefined;
        const doctorScope = auth.role === client_1.UserRole.doctor
            ? {
                appointments: {
                    some: { doctorId: auth.userId, deletedAt: null },
                },
            }
            : undefined;
        const combined = nameOrPhone && doctorScope
            ? { AND: [nameOrPhone, doctorScope] }
            : nameOrPhone ?? doctorScope ?? {};
        return this.prisma.patient.findMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, combined),
            orderBy: { name: 'asc' },
            take: 20,
        });
    }
    searchAppointments(auth, params) {
        const from = params.from != null && String(params.from).trim()
            ? new Date(String(params.from))
            : undefined;
        const to = params.to != null && String(params.to).trim()
            ? new Date(String(params.to))
            : undefined;
        const startTime = from || to
            ? {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
            }
            : undefined;
        const patientName = params.patientName ? String(params.patientName).trim() : '';
        const statusVal = params.isListingQuery
            ? undefined
            : params.status;
        const limit = (from || to) ? 50 : 30;
        return this.prisma.appointment.findMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, {
                deletedAt: null,
                doctorId: params.doctorId ? String(params.doctorId) : undefined,
                status: statusVal ?? undefined,
                startTime,
                ...(patientName
                    ? {
                        patient: {
                            name: { contains: patientName, mode: client_1.Prisma.QueryMode.insensitive },
                        },
                    }
                    : {}),
            }),
            include: {
                patient: { select: { name: true, phone: true } },
                doctor: { select: { name: true } },
                service: { select: { name: true } },
            },
            orderBy: { startTime: 'asc' },
            take: limit,
        });
    }
    searchInvoices(auth, params) {
        const from = params.from != null && String(params.from).trim()
            ? new Date(String(params.from))
            : undefined;
        const to = params.to != null && String(params.to).trim()
            ? new Date(String(params.to))
            : undefined;
        const createdAt = from || to
            ? {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
            }
            : undefined;
        const unpaidOnly = Boolean(params.unpaidOnly);
        const statusFilter = params.status;
        const patientName = params.patientName ? String(params.patientName).trim() : '';
        const statusClause = unpaidOnly
            ? {
                OR: [
                    { status: client_1.InvoiceStatus.draft },
                    { status: client_1.InvoiceStatus.partial, balance: { gt: 0 } },
                ],
            }
            : statusFilter
                ? { status: statusFilter }
                : undefined;
        const andParts = [];
        if (statusClause && Object.keys(statusClause).length > 0) {
            andParts.push(statusClause);
        }
        if (createdAt && Object.keys(createdAt).length > 0) {
            andParts.push({ createdAt });
        }
        if (patientName) {
            andParts.push({
                patient: {
                    name: { contains: patientName, mode: client_1.Prisma.QueryMode.insensitive },
                },
            });
        }
        if (auth.role === client_1.UserRole.doctor) {
            andParts.push({
                patient: {
                    appointments: {
                        some: { doctorId: auth.userId, deletedAt: null },
                    },
                },
            });
        }
        const invoiceWhere = andParts.length > 0 ? { AND: andParts } : {};
        return this.prisma.invoice.findMany({
            where: (0, tenant_prisma_helper_1.tenantWhere)(auth.tenantId, invoiceWhere),
            include: {
                patient: { select: { name: true, phone: true } },
                payments: { select: { amount: true, createdAt: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 30,
        });
    }
};
exports.ToolRegistryService = ToolRegistryService;
exports.ToolRegistryService = ToolRegistryService = ToolRegistryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        copilot_policy_service_1.CopilotPolicyService,
        copilot_authorization_service_1.CopilotAuthorizationService])
], ToolRegistryService);
//# sourceMappingURL=tool-registry.service.js.map