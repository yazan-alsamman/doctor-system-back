import { z } from 'zod';

export const PatchProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export type PatchProfileDto = z.infer<typeof PatchProfileSchema>;

export const PatchPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export type PatchPasswordDto = z.infer<typeof PatchPasswordSchema>;
