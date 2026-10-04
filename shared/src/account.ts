import { z } from 'zod';
import { passwordSchema } from './schemas.js';

/** Self-service account settings ("My account"). */
export const profileSchema = z.object({ name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long') });
export type ProfileInput = z.input<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })
  .refine((v) => v.newPassword !== v.currentPassword, { message: 'Choose a different password', path: ['newPassword'] });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export interface AccountSessionDto {
  id: string;
  current: boolean;
  /** Short description of the browser/device, from the user agent. */
  device: string;
  ipAddress: string | null;
  signedInAt: string;
  lastActiveAt: string;
  expiresAt: string;
}
