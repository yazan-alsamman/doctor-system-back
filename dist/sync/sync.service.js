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
var SyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = void 0;
exports.encodeCursor = encodeCursor;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../database/prisma.service");
const idempotency_service_1 = require("../common/idempotency/idempotency.service");
const patients_service_1 = require("../patients/patients.service");
const appointments_service_1 = require("../appointments/appointments.service");
const sync_batch_dto_1 = require("./dto/sync-batch.dto");
const BATCH_PATH = '/sync/batch';
const BATCH_METHOD = 'POST';
function decodeCursor(raw) {
    if (!raw?.trim())
        return null;
    try {
        const json = Buffer.from(raw, 'base64url').toString('utf8');
        const v = JSON.parse(json);
        if (typeof v.t === 'string' && typeof v.id === 'string')
            return { t: v.t, id: v.id };
    }
    catch {
        return null;
    }
    return null;
}
function encodeCursor(updatedAt, id) {
    return Buffer.from(JSON.stringify({ t: updatedAt.toISOString(), id }), 'utf8').toString('base64url');
}
let SyncService = SyncService_1 = class SyncService {
    prisma;
    idempotency;
    patients;
    appointments;
    logger = new common_1.Logger(SyncService_1.name);
    constructor(prisma, idempotency, patients, appointments) {
        this.prisma = prisma;
        this.idempotency = idempotency;
        this.patients = patients;
        this.appointments = appointments;
    }
    async getChanges(auth, query) {
        const limit = Math.min(500, Math.max(1, query.limit ?? 100));
        const cursor = decodeCursor(query.cursor);
        const typesRaw = query.types?.split(',').map((s) => s.trim()) ?? ['Patient', 'Appointment'];
        const wantPatient = typesRaw.some((t) => /patient/i.test(t));
        const wantAppt = typesRaw.some((t) => /appointment/i.test(t));
        const t0 = cursor ? new Date(cursor.t) : new Date(0);
        const id0 = cursor?.id ?? '';
        const patientWhere = {
            tenantId: auth.tenantId,
            OR: [
                { updatedAt: { gt: t0 } },
                { AND: [{ updatedAt: t0 }, { id: { gt: id0 } }] },
            ],
        };
        const apptBase = {
            tenantId: auth.tenantId,
            OR: [
                { updatedAt: { gt: t0 } },
                { AND: [{ updatedAt: t0 }, { id: { gt: id0 } }] },
            ],
        };
        const appointmentWhere = auth.role === client_1.UserRole.doctor
            ? { ...apptBase, doctorId: auth.userId }
            : apptBase;
        const fetchPerTable = Math.min(500, limit * 3);
        const [patientRows, apptRows] = await Promise.all([
            wantPatient
                ? this.prisma.patient.findMany({
                    where: patientWhere,
                    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
                    take: fetchPerTable,
                })
                : [],
            wantAppt
                ? this.prisma.appointment.findMany({
                    where: appointmentWhere,
                    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
                    take: fetchPerTable,
                })
                : [],
        ]);
        const merged = [];
        const pIt = patientRows[Symbol.iterator]();
        const aIt = apptRows[Symbol.iterator]();
        let pn = pIt.next();
        let an = aIt.next();
        const pickSmaller = () => {
            if (pn.done && an.done)
                return null;
            if (pn.done) {
                const a = an.value;
                an = aIt.next();
                return this.appointmentToChange(a);
            }
            if (an.done) {
                const p = pn.value;
                pn = pIt.next();
                return this.patientToChange(p);
            }
            const p = pn.value;
            const a = an.value;
            const pc = p.updatedAt.getTime() - a.updatedAt.getTime();
            if (pc < 0 || (pc === 0 && p.id < a.id)) {
                pn = pIt.next();
                return this.patientToChange(p);
            }
            an = aIt.next();
            return this.appointmentToChange(a);
        };
        while (merged.length < limit + 1) {
            const next = pickSmaller();
            if (!next)
                break;
            merged.push(next);
        }
        const hasMore = merged.length > limit;
        const page = hasMore ? merged.slice(0, limit) : merged;
        const last = page[page.length - 1];
        const nextCursor = hasMore && last ? encodeCursor(new Date(last.updatedAt), last.id) : null;
        return {
            items: page,
            nextCursor,
            serverTime: new Date().toISOString(),
            hasMore,
        };
    }
    patientToChange(p) {
        const deleted = !!p.deletedAt;
        return {
            entityType: 'Patient',
            id: p.id,
            op: deleted ? 'DELETE' : 'UPSERT',
            updatedAt: p.updatedAt.toISOString(),
            versionToken: p.updatedAt.toISOString(),
            payload: deleted
                ? { id: p.id, deletedAt: p.deletedAt?.toISOString() ?? null }
                : {
                    id: p.id,
                    tenantId: p.tenantId,
                    name: p.name,
                    phone: p.phone,
                    dob: p.dob?.toISOString() ?? null,
                    notes: p.notes,
                    sex: p.sex,
                    bloodType: p.bloodType,
                    recordStatus: p.recordStatus,
                    ageYears: p.ageYears,
                    allergies: p.allergies,
                    medications: p.medications,
                    vitals: p.vitals,
                    createdAt: p.createdAt.toISOString(),
                    updatedAt: p.updatedAt.toISOString(),
                    deletedAt: p.deletedAt?.toISOString() ?? null,
                },
        };
    }
    appointmentToChange(a) {
        const deleted = !!a.deletedAt;
        return {
            entityType: 'Appointment',
            id: a.id,
            op: deleted ? 'DELETE' : 'UPSERT',
            updatedAt: a.updatedAt.toISOString(),
            versionToken: a.updatedAt.toISOString(),
            payload: deleted
                ? { id: a.id, deletedAt: a.deletedAt?.toISOString() ?? null }
                : {
                    id: a.id,
                    tenantId: a.tenantId,
                    patientId: a.patientId,
                    doctorId: a.doctorId,
                    serviceId: a.serviceId,
                    baseTotal: String(a.baseTotal),
                    discount: String(a.discount),
                    finalTotal: String(a.finalTotal),
                    manualPriceOverride: a.manualPriceOverride != null ? String(a.manualPriceOverride) : null,
                    consentObtained: a.consentObtained,
                    treatmentDetails: a.treatmentDetails,
                    doctorRemarks: a.doctorRemarks,
                    specialConditions: a.specialConditions,
                    status: a.status,
                    startTime: a.startTime.toISOString(),
                    endTime: a.endTime.toISOString(),
                    overbooked: a.overbooked,
                    notes: a.notes,
                    createdAt: a.createdAt.toISOString(),
                    updatedAt: a.updatedAt.toISOString(),
                    deletedAt: a.deletedAt?.toISOString() ?? null,
                },
        };
    }
    async applyBatch(auth, dto) {
        const results = [];
        for (let i = 0; i < dto.ops.length; i += 1) {
            const op = dto.ops[i];
            const hash = this.idempotency.requestHash(op.operation, op.payload);
            const replay = await this.idempotency.replayOrNull(auth.tenantId, auth.userId, op.idempotencyKey, hash, BATCH_PATH, BATCH_METHOD);
            if (replay) {
                results.push({ ...replay.responseBody, opIndex: i });
                continue;
            }
            let outcome;
            try {
                outcome = { opIndex: i, ...(await this.executeOne(auth, op)) };
            }
            catch (e) {
                outcome = this.errorToResult(i, e);
            }
            await this.idempotency.saveSuccess(auth.tenantId, auth.userId, op.idempotencyKey, hash, BATCH_PATH, BATCH_METHOD, outcome.status, outcome);
            results.push(outcome);
        }
        return { results };
    }
    errorToResult(opIndex, e) {
        if (e instanceof common_1.HttpException) {
            const status = e.getStatus();
            const res = e.getResponse();
            let msg;
            if (typeof res === 'string') {
                msg = res;
            }
            else if (res && typeof res === 'object' && 'message' in res) {
                const m = res.message;
                if (Array.isArray(m))
                    msg = m.join(', ');
                else
                    msg = String(m ?? e.message);
            }
            else {
                msg = e.message;
            }
            const code = res && typeof res === 'object' && 'code' in res
                ? String(res.code)
                : undefined;
            return {
                opIndex,
                status,
                ok: false,
                error: { code, message: msg, status },
            };
        }
        this.logger.warn(`Sync batch op failed: ${String(e)}`);
        return {
            opIndex,
            status: 500,
            ok: false,
            error: { code: 'SYNC_OP_FAILED', message: 'Internal error', status: 500 },
        };
    }
    async executeOne(auth, op) {
        if (op.operation === 'RECORD_PAYMENT' || op.operation === 'RECORD_REFUND') {
            throw new common_1.BadRequestException({
                message: 'Financial operations cannot be applied via sync batch. Use online payment/refund endpoints.',
                code: 'FINANCIAL_SYNC_DISABLED',
                status: 400,
            });
        }
        if (op.operation === 'PATCH_PATIENT') {
            const parsed = sync_batch_dto_1.PatchPatientPayloadSchema.safeParse(op.payload);
            if (!parsed.success) {
                throw new common_1.BadRequestException({
                    message: parsed.error.message,
                    code: 'INVALID_SYNC_PAYLOAD',
                    status: 400,
                });
            }
            const data = await this.patients.update(auth, parsed.data.id, parsed.data.patch);
            return { status: 200, ok: true, data };
        }
        if (op.operation === 'CREATE_PATIENT') {
            const parsed = sync_batch_dto_1.CreatePatientPayloadSchema.safeParse(op.payload);
            if (!parsed.success) {
                throw new common_1.BadRequestException({
                    message: parsed.error.message,
                    code: 'INVALID_SYNC_PAYLOAD',
                    status: 400,
                });
            }
            const data = await this.patients.create(auth, parsed.data);
            return { status: 200, ok: true, data };
        }
        if (op.operation === 'PATCH_APPOINTMENT') {
            const parsed = sync_batch_dto_1.PatchAppointmentPayloadSchema.safeParse(op.payload);
            if (!parsed.success) {
                throw new common_1.BadRequestException({
                    message: parsed.error.message,
                    code: 'INVALID_SYNC_PAYLOAD',
                    status: 400,
                });
            }
            const data = await this.appointments.update(auth, parsed.data.id, parsed.data.patch);
            return { status: 200, ok: true, data };
        }
        throw new common_1.BadRequestException({
            message: `Unsupported operation: ${op.operation}`,
            code: 'UNSUPPORTED_SYNC_OPERATION',
            status: 400,
        });
    }
    async getSyncStatus(auth) {
        return {
            serverTime: new Date().toISOString(),
            tenantId: auth.tenantId,
            idempotencyTtlHours: Number(process.env.IDEMPOTENCY_TTL_HOURS || 72) || 72,
        };
    }
};
exports.SyncService = SyncService;
exports.SyncService = SyncService = SyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        idempotency_service_1.IdempotencyService,
        patients_service_1.PatientsService,
        appointments_service_1.AppointmentsService])
], SyncService);
//# sourceMappingURL=sync.service.js.map