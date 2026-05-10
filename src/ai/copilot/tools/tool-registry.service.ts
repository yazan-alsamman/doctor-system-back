import { Injectable, Logger } from '@nestjs/common';
import {
  AppointmentStatus,
  InvoiceStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { tenantWhere } from '../../../common/tenant-prisma.helper';
import type { AuthContext } from '../../../common/auth-context';
import { CopilotAuthorizationService } from '../v2/copilot-authorization.service';
import { CopilotPolicyService } from '../v2/copilot-policy.service';
import type { IntentType } from '../intent/intent.types';
import type { ToolName, ToolResult } from './tool.types';
import {
  assertSearchExecutionArgs,
  isSearchToolName,
} from '../v2/search-tool-args';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: CopilotPolicyService,
    private readonly authz: CopilotAuthorizationService,
  ) {}

  async executeForIntent(
    intent: IntentType,
    auth: AuthContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult[]> {
    const tools = this.selectTools(intent, params);
    if (tools.length === 0) return [];

    const settled = await Promise.allSettled(
      tools.map(async (name): Promise<ToolResult> => {
        const data = await this.run(name, auth, params);
        return { tool: name, data };
      }),
    );

    return settled.map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      this.logger.warn(`Tool ${tools[i]} failed: ${String(result.reason).slice(0, 200)}`);
      return { tool: tools[i], data: null, error: 'tool_failed' };
    });
  }

  // ─── Tool Selection ────────────────────────────────────────────────────────

  private selectTools(
    intent: IntentType,
    params: Record<string, unknown>,
  ): ToolName[] {
    switch (intent) {
      case 'scheduling': {
        // Listing/counting queries need existing appointments, not available slots
        const isListing = Boolean(params.isListingQuery) ||
          /كم|عدد|قائمة|اعرض|أظهر|ما مواعيد|list|show|how many|count/i.test(
            String(params.searchQuery ?? ''),
          );
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

  /** Keyword-based multi-tool fallback when NL planner yields no usable plan. */
  getSearchToolsForFallbackParams(params: Record<string, unknown>): ToolName[] {
    return this.selectSearchTools(params);
  }

  private finalizeSearchParams(name: ToolName, params: Record<string, unknown>): Record<string, unknown> {
    if (!isSearchToolName(name)) return params;
    return assertSearchExecutionArgs(name, params);
  }

  private selectSearchTools(params: Record<string, unknown>): ToolName[] {
    const q = String(params.searchQuery ?? params.q ?? '').toLowerCase();
    if (/patient|مريض|مرضى/.test(q)) return ['searchPatients'];
    if (/invoice|فاتورة|فواتير|دفع|مدفوع|مبلغ/.test(q)) return ['searchInvoices'];
    if (/appointment|موعد|مواعيد/.test(q)) return ['searchAppointments'];
    return ['searchPatients', 'searchAppointments'];
  }

  async executeTool(
    name: ToolName,
    auth: AuthContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    try {
      const data = await this.run(name, auth, params);
      return { tool: name, data };
    } catch (err) {
      this.logger.warn(
        `executeTool ${name} failed: ${String(err).slice(0, 200)}`,
      );
      return { tool: name, data: null, error: 'tool_failed' };
    }
  }

  // ─── Tool Dispatcher ───────────────────────────────────────────────────────

  private async run(
    name: ToolName,
    auth: AuthContext,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.policy.allowedTools(auth.role).has(name)) {
      this.logger.debug(`Tool ${name} blocked for role ${auth.role}`);
      return null;
    }

    let effectiveParams = params;
    if (isSearchToolName(name)) {
      effectiveParams = this.finalizeSearchParams(name, params);
    }

    const scoped = await this.applyScopedParams(name, auth, effectiveParams);
    if (scoped === null) return null;

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
        /* Messaging copy is produced by the LLM; no separate DB mutation tool */
        return null;
      case 'searchAppointments':
        return this.searchAppointments(auth, scoped);
      case 'searchPatients':
        return this.searchPatients(auth, scoped);
      case 'searchInvoices':
        return this.searchInvoices(auth, scoped);
    }
  }

  /**
   * Validates UUID-shaped ids and applies doctor / clinical access rules before Prisma.
   */
  private async applyScopedParams(
    tool: ToolName,
    auth: AuthContext,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    let next = { ...params };

    if (next.doctorId != null && String(next.doctorId).trim() !== '') {
      const d = this.authz.parseUuid(next.doctorId);
      if (!d) return null;
      next = { ...next, doctorId: d };
    }
    if (next.patientId != null && String(next.patientId).trim() !== '') {
      const p = this.authz.parseUuid(next.patientId);
      if (!p) return null;
      next = { ...next, patientId: p };
    }

    switch (tool) {
      case 'getAvailableSlots':
      case 'getDoctorSchedule':
      case 'searchAppointments': {
        const requested =
          next.doctorId !== undefined && next.doctorId !== null
            ? String(next.doctorId)
            : undefined;
        const resolved = await this.authz.resolveDoctorId(auth, requested);
        if (resolved === null) return null;
        if (resolved !== undefined) {
          next = { ...next, doctorId: resolved };
        } else {
          const { doctorId: _, ...rest } = next;
          next = rest;
        }
        return next;
      }
      case 'getPatientHistory':
      case 'getPatientSummary': {
        const pid = this.authz.parseUuid(next.patientId);
        if (!pid) return null;
        const ok = await this.authz.canReadClinicalPatient(auth, pid);
        if (!ok) return null;
        return { ...next, patientId: pid };
      }
      default:
        return next;
    }
  }

  // ─── Tool Implementations (READ-ONLY — never mutate) ──────────────────────

  private async getAvailableSlots(
    auth: AuthContext,
    params: Record<string, unknown>,
  ) {
    const from = params.from ? new Date(String(params.from)) : new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + 7);

    const [schedules, bookedSlots] = await Promise.all([
      this.prisma.doctorSchedule.findMany({
        where: tenantWhere(auth.tenantId, {
          doctorId: params.doctorId ? String(params.doctorId) : undefined,
          deletedAt: null,
        }),
        include: {
          doctor: { select: { id: true, name: true, title: true } },
        },
        orderBy: [{ doctorId: 'asc' }, { dayOfWeek: 'asc' }],
      }),
      this.prisma.appointment.findMany({
        where: tenantWhere(auth.tenantId, {
          doctorId: params.doctorId ? String(params.doctorId) : undefined,
          startTime: { gte: from, lte: to },
          deletedAt: null,
          status: { notIn: [AppointmentStatus.cancelled, AppointmentStatus.no_show] },
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

  private getDoctorSchedule(
    auth: AuthContext,
    params: Record<string, unknown>,
  ) {
    return this.prisma.doctorSchedule.findMany({
      where: tenantWhere(auth.tenantId, {
        doctorId: params.doctorId ? String(params.doctorId) : undefined,
        deletedAt: null,
      }),
      include: {
        doctor: { select: { id: true, name: true, title: true } },
      },
      orderBy: [{ doctorId: 'asc' }, { dayOfWeek: 'asc' }],
    });
  }

  private async detectConflicts(
    auth: AuthContext,
    params: Record<string, unknown>,
  ) {
    const from = params.from ? new Date(String(params.from)) : new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    return this.prisma.appointment.findMany({
      where: tenantWhere(auth.tenantId, {
        startTime: { gte: from, lte: to },
        overbooked: true,
        deletedAt: null,
        ...(auth.role === UserRole.doctor ? { doctorId: auth.userId } : {}),
      }),
      include: {
        patient: { select: { name: true } },
        doctor: { select: { name: true } },
        service: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  private async getPatientHistory(
    auth: AuthContext,
    params: Record<string, unknown>,
  ) {
    const patientId = params.patientId ? String(params.patientId) : undefined;
    if (!patientId) return null;

    const appointmentWhere =
      auth.role === UserRole.doctor
        ? { patientId, doctorId: auth.userId, deletedAt: null }
        : { patientId, deletedAt: null };

    const invoicesPromise =
      auth.role === UserRole.doctor
        ? Promise.resolve([])
        : this.prisma.invoice.findMany({
            where: tenantWhere(auth.tenantId, { patientId }),
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
        where: tenantWhere(auth.tenantId, { id: patientId }),
      }),
      this.prisma.appointment.findMany({
        where: tenantWhere(auth.tenantId, appointmentWhere),
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

  private getPatientSummary(
    auth: AuthContext,
    params: Record<string, unknown>,
  ) {
    const patientId = params.patientId ? String(params.patientId) : undefined;
    if (!patientId) return Promise.resolve(null);

    return this.prisma.patient.findFirst({
      where: tenantWhere(auth.tenantId, { id: patientId }),
      include: {
        appointments: {
          where: {
            deletedAt: null,
            ...(auth.role === UserRole.doctor ? { doctorId: auth.userId } : {}),
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

  private getInvoiceData(
    auth: AuthContext,
    params: Record<string, unknown>,
  ) {
    const from = params.from
      ? new Date(String(params.from))
      : (() => { const d = new Date(); d.setDate(1); return d; })();
    const to = params.to ? new Date(String(params.to)) : new Date();

    return this.prisma.invoice.findMany({
      where: tenantWhere(auth.tenantId, {
        status: (params.status as 'draft' | 'paid' | 'partial') || undefined,
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

  private async getRevenueStats(
    auth: AuthContext,
    params: Record<string, unknown>,
  ) {
    const from = params.from
      ? new Date(String(params.from))
      : (() => { const d = new Date(); d.setDate(1); return d; })();
    const to = params.to ? new Date(String(params.to)) : new Date();

    const [invoiceGroups, appointmentGroups] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: tenantWhere(auth.tenantId, {
          createdAt: { gte: from, lte: to },
        }),
        _count: { _all: true },
        _sum: { totalAmount: true, finalAmount: true, totalPaid: true, balance: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: tenantWhere(auth.tenantId, {
          startTime: { gte: from, lte: to },
        }),
        _count: { _all: true },
      }),
    ]);

    return { invoiceStats: invoiceGroups, appointmentStats: appointmentGroups, period: { from, to } };
  }

  private searchPatients(auth: AuthContext, params: Record<string, unknown>) {
    const q = String(params.q ?? params.name ?? params.searchQuery ?? '').trim();
    const nameOrPhone: Prisma.PatientWhereInput | undefined = q
      ? {
          OR: [
            { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { phone: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : undefined;

    const doctorScope: Prisma.PatientWhereInput | undefined =
      auth.role === UserRole.doctor
        ? {
            appointments: {
              some: { doctorId: auth.userId, deletedAt: null },
            },
          }
        : undefined;

    const combined: Prisma.PatientWhereInput =
      nameOrPhone && doctorScope
        ? { AND: [nameOrPhone, doctorScope] }
        : nameOrPhone ?? doctorScope ?? {};

    return this.prisma.patient.findMany({
      where: tenantWhere(auth.tenantId, combined),
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  private searchAppointments(
    auth: AuthContext,
    params: Record<string, unknown>,
  ) {
    const from =
      params.from != null && String(params.from).trim()
        ? new Date(String(params.from))
        : undefined;
    const to =
      params.to != null && String(params.to).trim()
        ? new Date(String(params.to))
        : undefined;

    const startTime =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    const patientName = params.patientName ? String(params.patientName).trim() : '';

    // When used as a listing tool (scheduling intent), do not filter by status
    // so all of today's appointments appear regardless of their state.
    const statusVal = params.isListingQuery
      ? undefined
      : (params.status as AppointmentStatus | undefined);

    // For date-filtered listing queries return more results (up to 50)
    const limit = (from || to) ? 50 : 30;

    return this.prisma.appointment.findMany({
      where: tenantWhere(auth.tenantId, {
        deletedAt: null,
        doctorId: params.doctorId ? String(params.doctorId) : undefined,
        status: statusVal ?? undefined,
        startTime,
        ...(patientName
          ? {
              patient: {
                name: { contains: patientName, mode: Prisma.QueryMode.insensitive },
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

  private searchInvoices(auth: AuthContext, params: Record<string, unknown>) {
    const from =
      params.from != null && String(params.from).trim()
        ? new Date(String(params.from))
        : undefined;
    const to =
      params.to != null && String(params.to).trim()
        ? new Date(String(params.to))
        : undefined;

    const createdAt =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    const unpaidOnly = Boolean(params.unpaidOnly);
    const statusFilter = params.status as InvoiceStatus | undefined;

    const patientName = params.patientName ? String(params.patientName).trim() : '';

    const statusClause: Prisma.InvoiceWhereInput | undefined = unpaidOnly
      ? {
          OR: [
            { status: InvoiceStatus.draft },
            { status: InvoiceStatus.partial, balance: { gt: 0 } },
          ],
        }
      : statusFilter
        ? { status: statusFilter }
        : undefined;

    const andParts: Prisma.InvoiceWhereInput[] = [];
    if (statusClause && Object.keys(statusClause).length > 0) {
      andParts.push(statusClause);
    }
    if (createdAt && Object.keys(createdAt).length > 0) {
      andParts.push({ createdAt });
    }
    if (patientName) {
      andParts.push({
        patient: {
          name: { contains: patientName, mode: Prisma.QueryMode.insensitive },
        },
      });
    }

    if (auth.role === UserRole.doctor) {
      andParts.push({
        patient: {
          appointments: {
            some: { doctorId: auth.userId, deletedAt: null },
          },
        },
      });
    }

    const invoiceWhere: Prisma.InvoiceWhereInput =
      andParts.length > 0 ? { AND: andParts } : {};

    return this.prisma.invoice.findMany({
      where: tenantWhere(auth.tenantId, invoiceWhere),
      include: {
        patient: { select: { name: true, phone: true } },
        payments: { select: { amount: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }
}
