/**
 * Request schemas shared by backend validation and frontend forms.
 * The backend is the source of truth: it validates every request with these.
 */
import { z } from 'zod';
import { FIELD_TYPES } from './fields.js';
import { ALL_PERMISSIONS, CAMP_SCOPES } from './permissions.js';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id');
const name = (label: string, max = 80) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128, 'At most 128 characters')
  .refine((v) => /[a-z]/i.test(v) && /\d/.test(v), 'Use letters and numbers');

// ───────── Roles ─────────

export const roleInputSchema = z.object({
  name: name('Role name', 60),
  description: z.string().trim().max(300).optional().default(''),
  permissions: z
    .array(z.enum(ALL_PERMISSIONS as [string, ...string[]]))
    .max(ALL_PERMISSIONS.length)
    .transform((list) => [...new Set(list)]),
  campScope: z.enum(CAMP_SCOPES),
});
export type RoleInput = z.input<typeof roleInputSchema>;

export const invalidateSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required').max(300),
});
export type InvalidateInput = z.infer<typeof invalidateSchema>;

// ───────── Users ─────────

export const userCreateSchema = z.object({
  name: name('Name'),
  email: z.email('Enter a valid email').trim().toLowerCase(),
  password: passwordSchema,
  roleId: objectId,
  campIds: z.array(objectId).default([]),
});
export type UserCreateInput = z.input<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  name: name('Name'),
  roleId: objectId,
  campIds: z.array(objectId).default([]),
});
export type UserUpdateInput = z.input<typeof userUpdateSchema>;

export const userActiveSchema = z.object({ active: z.boolean() });

export const passwordResetSchema = z.object({ password: passwordSchema });

// ───────── Custom fields ─────────

const optionsSchema = z
  .array(z.string().trim().min(1).max(60))
  .max(100)
  .transform((list) => [...new Set(list)]);

export const fieldCreateSchema = z
  .object({
    label: name('Label', 60),
    type: z.enum(FIELD_TYPES),
    options: optionsSchema.default([]),
    required: z.boolean().default(false),
  })
  .refine((v) => v.type !== 'SELECT' || v.options.length > 0, {
    path: ['options'],
    message: 'Dropdown fields need at least one option',
  });
export type FieldCreateInput = z.input<typeof fieldCreateSchema>;

/** Type cannot change after creation; options can be added, and removed only if no worker uses them. */
export const fieldUpdateSchema = z.object({
  label: name('Label', 60),
  options: optionsSchema.default([]),
  required: z.boolean().default(false),
});
export type FieldUpdateInput = z.input<typeof fieldUpdateSchema>;

export const fieldHiddenSchema = z.object({ hidden: z.boolean() });
