import { z } from 'zod';
import { CreatePatientSchema } from '../../patients/dto/create-patient.dto';
import { UpdatePatientSchema } from '../../patients/dto/update-patient.dto';
import { UpdateAppointmentSchema } from '../../appointments/dto/update-appointment.dto';

/** Batch envelope — each op carries its own idempotency key (replay-safe per operation). */
export const SyncBatchOpSchema = z.object({
  idempotencyKey: z.string().uuid(),
  operation: z.enum([
    'PATCH_PATIENT',
    'CREATE_PATIENT',
    'PATCH_APPOINTMENT',
    /** Explicitly rejected server-side — reserved for future guarded flows */
    'RECORD_PAYMENT',
    'RECORD_REFUND',
  ]),
  payload: z.record(z.string(), z.unknown()),
});

export const SyncBatchSchema = z.object({
  ops: z.array(SyncBatchOpSchema).min(1).max(50),
});

export type SyncBatchDto = z.infer<typeof SyncBatchSchema>;

export const PatchPatientPayloadSchema = z.object({
  id: z.string().uuid(),
  patch: UpdatePatientSchema,
});

export const CreatePatientPayloadSchema = CreatePatientSchema;

export const PatchAppointmentPayloadSchema = z.object({
  id: z.string().uuid(),
  patch: UpdateAppointmentSchema,
});

export type SyncBatchOpDto = z.infer<typeof SyncBatchOpSchema>;
