import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AppointmentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { AuthContext } from '../common/auth-context';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { PatientsService } from '../patients/patients.service';
import { AppointmentsService } from '../appointments/appointments.service';
import type { SyncBatchDto, SyncBatchOpDto } from './dto/sync-batch.dto';
import {
  CreatePatientPayloadSchema,
  PatchAppointmentPayloadSchema,
  PatchPatientPayloadSchema,
} from './dto/sync-batch.dto';

export type SyncChangeItem =
  | {
      entityType: 'Patient';
      id: string;
      op: 'UPSERT' | 'DELETE';
      updatedAt: string;
      versionToken: string;
      payload: Record<string, unknown>;
    }
  | {
      entityType: 'Appointment';
      id: string;
      op: 'UPSERT' | 'DELETE';
      updatedAt: string;
      versionToken: string;
      payload: Record<string, unknown>;
    };

type Cursor = { t: string; id: string };

const BATCH_PATH = '/sync/batch';
const BATCH_METHOD = 'POST';

function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw?.trim()) return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const v = JSON.parse(json) as { t?: string; id?: string };
    if (typeof v.t === 'string' && typeof v.id === 'string') return { t: v.t, id: v.id };
  } catch {
    return null;
  }
  return null;
}

export function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: updatedAt.toISOString(), id }), 'utf8').toString('base64url');
}

type BatchOpResult = {
  opIndex: number;
  status: number;
  ok: boolean;
  data?: unknown;
  error?: { code?: string; message: string; status: number };
};

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly patients: PatientsService,
    private readonly appointments: AppointmentsService,
  ) {}

  async getChanges(
    auth: AuthContext,
    query: { cursor?: string; limit?: number; types?: string },
  ): Promise<{
    items: SyncChangeItem[];
    nextCursor: string | null;
    serverTime: string;
    hasMore: boolean;
  }> {
    const limit = Math.min(500, Math.max(1, query.limit ?? 100));
    const cursor = decodeCursor(query.cursor);
    const typesRaw = query.types?.split(',').map((s) => s.trim()) ?? ['Patient', 'Appointment'];
    const wantPatient = typesRaw.some((t) => /patient/i.test(t));
    const wantAppt = typesRaw.some((t) => /appointment/i.test(t));

    const t0 = cursor ? new Date(cursor.t) : new Date(0);
    const id0 = cursor?.id ?? '';

    // Include soft-deleted rows so clients receive tombstones (pull sync).
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
    const appointmentWhere =
      auth.role === UserRole.doctor
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

    const merged: SyncChangeItem[] = [];

    const pIt = patientRows[Symbol.iterator]();
    const aIt = apptRows[Symbol.iterator]();
    let pn = pIt.next();
    let an = aIt.next();

    const pickSmaller = (): SyncChangeItem | null => {
      if (pn.done && an.done) return null;
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
      if (!next) break;
      merged.push(next);
    }

    const hasMore = merged.length > limit;
    const page = hasMore ? merged.slice(0, limit) : merged;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor(new Date(last.updatedAt), last.id) : null;

    return {
      items: page,
      nextCursor,
      serverTime: new Date().toISOString(),
      hasMore,
    };
  }

  private patientToChange(p: {
    id: string;
    updatedAt: Date;
    deletedAt: Date | null;
    tenantId: string;
    name: string;
    phone: string;
    dob: Date | null;
    notes: string | null;
    sex: string;
    bloodType: string;
    recordStatus: string;
    ageYears: number | null;
    allergies: string[];
    medications: unknown;
    vitals: unknown;
    createdAt: Date;
  }): SyncChangeItem {
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

  private appointmentToChange(a: {
    id: string;
    updatedAt: Date;
    deletedAt: Date | null;
    tenantId: string;
    patientId: string;
    doctorId: string;
    serviceId: string;
    baseTotal: unknown;
    discount: unknown;
    finalTotal: unknown;
    manualPriceOverride: unknown;
    consentObtained: boolean;
    treatmentDetails: string | null;
    doctorRemarks: string | null;
    specialConditions: string | null;
    status: AppointmentStatus;
    startTime: Date;
    endTime: Date;
    overbooked: boolean;
    notes: string | null;
    createdAt: Date;
  }): SyncChangeItem {
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

  async applyBatch(auth: AuthContext, dto: SyncBatchDto): Promise<{ results: BatchOpResult[] }> {
    const results: BatchOpResult[] = [];

    for (let i = 0; i < dto.ops.length; i += 1) {
      const op = dto.ops[i]!;
      const hash = this.idempotency.requestHash(op.operation, op.payload);
      const replay = await this.idempotency.replayOrNull<BatchOpResult>(
        auth.tenantId,
        auth.userId,
        op.idempotencyKey,
        hash,
        BATCH_PATH,
        BATCH_METHOD,
      );
      if (replay) {
        results.push({ ...replay.responseBody, opIndex: i });
        continue;
      }

      let outcome: BatchOpResult;
      try {
        outcome = { opIndex: i, ...(await this.executeOne(auth, op)) };
      } catch (e) {
        outcome = this.errorToResult(i, e);
      }

      await this.idempotency.saveSuccess(
        auth.tenantId,
        auth.userId,
        op.idempotencyKey,
        hash,
        BATCH_PATH,
        BATCH_METHOD,
        outcome.status,
        outcome,
      );
      results.push(outcome);
    }

    return { results };
  }

  private errorToResult(opIndex: number, e: unknown): BatchOpResult {
    if (e instanceof HttpException) {
      const status = e.getStatus();
      const res = e.getResponse();
      let msg: string;
      if (typeof res === 'string') {
        msg = res;
      } else if (res && typeof res === 'object' && 'message' in res) {
        const m = (res as { message?: unknown }).message;
        if (Array.isArray(m)) msg = m.join(', ');
        else msg = String(m ?? e.message);
      } else {
        msg = e.message;
      }
      const code =
        res && typeof res === 'object' && 'code' in res
          ? String((res as { code?: unknown }).code)
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

  private async executeOne(
    auth: AuthContext,
    op: SyncBatchOpDto,
  ): Promise<Omit<BatchOpResult, 'opIndex'>> {
    if (op.operation === 'RECORD_PAYMENT' || op.operation === 'RECORD_REFUND') {
      throw new BadRequestException({
        message:
          'Financial operations cannot be applied via sync batch. Use online payment/refund endpoints.',
        code: 'FINANCIAL_SYNC_DISABLED',
        status: 400,
      });
    }

    if (op.operation === 'PATCH_PATIENT') {
      const parsed = PatchPatientPayloadSchema.safeParse(op.payload);
      if (!parsed.success) {
        throw new BadRequestException({
          message: parsed.error.message,
          code: 'INVALID_SYNC_PAYLOAD',
          status: 400,
        });
      }
      const data = await this.patients.update(auth, parsed.data.id, parsed.data.patch);
      return { status: 200, ok: true, data };
    }

    if (op.operation === 'CREATE_PATIENT') {
      const parsed = CreatePatientPayloadSchema.safeParse(op.payload);
      if (!parsed.success) {
        throw new BadRequestException({
          message: parsed.error.message,
          code: 'INVALID_SYNC_PAYLOAD',
          status: 400,
        });
      }
      const data = await this.patients.create(auth, parsed.data);
      return { status: 200, ok: true, data };
    }

    if (op.operation === 'PATCH_APPOINTMENT') {
      const parsed = PatchAppointmentPayloadSchema.safeParse(op.payload);
      if (!parsed.success) {
        throw new BadRequestException({
          message: parsed.error.message,
          code: 'INVALID_SYNC_PAYLOAD',
          status: 400,
        });
      }
      const data = await this.appointments.update(auth, parsed.data.id, parsed.data.patch);
      return { status: 200, ok: true, data };
    }

    throw new BadRequestException({
      message: `Unsupported operation: ${op.operation}`,
      code: 'UNSUPPORTED_SYNC_OPERATION',
      status: 400,
    });
  }

  async getSyncStatus(auth: AuthContext): Promise<{
    serverTime: string;
    tenantId: string;
    idempotencyTtlHours: number;
  }> {
    return {
      serverTime: new Date().toISOString(),
      tenantId: auth.tenantId,
      idempotencyTtlHours: Number(process.env.IDEMPOTENCY_TTL_HOURS || 72) || 72,
    };
  }
}
