import { AppointmentStatus, InvoiceStatus } from '@prisma/client';
import { z } from 'zod';

export type SearchToolName =
  | 'searchPatients'
  | 'searchAppointments'
  | 'searchInvoices';

/**
 * Maps NL filter blobs into the exact keys {@link ToolRegistryService} read methods consume,
 * stripping unknown keys (LLM cannot widen Prisma query surface).
 */
export function normalizeSearchToolArgs(
  tool: SearchToolName,
  filters: Record<string, unknown>,
): Record<string, unknown> {
  const base: Record<string, unknown> = {};

  if (filters.from != null && String(filters.from).trim()) {
    base.from = String(filters.from);
  }
  if (filters.to != null && String(filters.to).trim()) {
    base.to = String(filters.to);
  }

  if (tool === 'searchPatients') {
    const q =
      filters.q ??
      filters.name ??
      filters.phone ??
      filters.patientName ??
      filters.patient_name ??
      filters.searchQuery;
    if (q != null && String(q).trim()) base.q = String(q).slice(0, 2000);
    return validateSearchPatientsArgs(base);
  }

  if (tool === 'searchAppointments') {
    // Do NOT map `searchQuery` → patientName: for scheduling listing it is the full user
    // sentence (e.g. "كم موعد اليوم؟") and would incorrectly filter patients by that string.
    const pn = filters.patientName ?? filters.patient_name;
    if (pn != null && String(pn).trim()) base.patientName = String(pn).slice(0, 500);
    if (filters.doctorId != null && String(filters.doctorId).trim()) {
      const did = String(filters.doctorId);
      if (z.string().uuid().safeParse(did).success) base.doctorId = did;
    }
    if (filters.status != null && String(filters.status).trim()) {
      base.status = String(filters.status);
    }
    if (typeof filters.isListingQuery === 'boolean') {
      base.isListingQuery = filters.isListingQuery;
    }
    return validateSearchAppointmentsArgs(base);
  }

  const inv: Record<string, unknown> = { ...base };
  const pn = filters.patientName ?? filters.patient_name;
  if (pn != null && String(pn).trim()) inv.patientName = String(pn).slice(0, 500);
  const st = filters.status != null ? String(filters.status).toLowerCase() : '';
  if (st === 'unpaid' || filters.unpaid === true) {
    inv.unpaidOnly = true;
  } else if (filters.status != null && String(filters.status).trim()) {
    inv.status = String(filters.status);
  }
  return validateSearchInvoicesArgs(inv);
}

/** Build filter-shaped input from shared {@link resolveToolParams} output for multi-tool fallback. */
export function paramsToSearchFilters(
  tool: SearchToolName,
  params: Record<string, unknown>,
): Record<string, unknown> {
  switch (tool) {
    case 'searchPatients':
      return {
        q: params.searchQuery,
        from: params.from,
        to: params.to,
      };
    case 'searchAppointments':
      return {
        from: params.from,
        to: params.to,
        patientName: params.patientName,
        doctorId: params.doctorId,
        isListingQuery: params.isListingQuery,
      };
    case 'searchInvoices':
      return {
        from: params.from,
        to: params.to,
        patientName: params.patientName,
      };
    default:
      return {};
  }
}

const SearchPatientsArgsSchema = z
  .object({
    q: z.string().max(2000).optional(),
    from: z.string().max(80).optional(),
    to: z.string().max(80).optional(),
  })
  .strict();

const SearchAppointmentsArgsSchema = z
  .object({
    from: z.string().max(80).optional(),
    to: z.string().max(80).optional(),
    patientName: z.string().max(500).optional(),
    doctorId: z.string().uuid().optional(),
    status: z.nativeEnum(AppointmentStatus).optional(),
    isListingQuery: z.boolean().optional(),
  })
  .strict();

const SearchInvoicesArgsSchema = z
  .object({
    from: z.string().max(80).optional(),
    to: z.string().max(80).optional(),
    patientName: z.string().max(500).optional(),
    unpaidOnly: z.boolean().optional(),
    status: z.nativeEnum(InvoiceStatus).optional(),
  })
  .strict();

function validateSearchPatientsArgs(args: Record<string, unknown>): Record<string, unknown> {
  return SearchPatientsArgsSchema.parse(args);
}

function validateSearchAppointmentsArgs(args: Record<string, unknown>): Record<string, unknown> {
  const st = args.status;
  if (typeof st === 'string' && st.trim()) {
    if (!(st in AppointmentStatus)) {
      const { status: _, ...rest } = args;
      return SearchAppointmentsArgsSchema.parse(rest);
    }
  }
  return SearchAppointmentsArgsSchema.parse(args);
}

function validateSearchInvoicesArgs(args: Record<string, unknown>): Record<string, unknown> {
  const st = args.status;
  if (typeof st === 'string' && st.trim() && !(st in InvoiceStatus)) {
    const { status: _, ...rest } = args;
    return SearchInvoicesArgsSchema.parse(rest);
  }
  return SearchInvoicesArgsSchema.parse(args);
}

/**
 * Final gate before Prisma — strips unknown planner keys, maps aliases, then validates strict schemas.
 */
export function assertSearchExecutionArgs(
  tool: SearchToolName,
  args: Record<string, unknown>,
): Record<string, unknown> {
  return normalizeSearchToolArgs(tool, args);
}

export function isSearchToolName(t: string): t is SearchToolName {
  return t === 'searchPatients' || t === 'searchAppointments' || t === 'searchInvoices';
}
