import { z } from 'zod';
import { isIsoDate } from './dates.js';

/** Audit actions written by the backend (see AuditService). */
export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'HIDE',
  'UNHIDE',
  'INVALIDATE',
  'ASSIGN',
  'MOVE',
  'EXIT',
  'LEAVE_START',
  'LEAVE_RETURN',
  'PASSWORD_CHANGE',
  'IMPORT',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  HIDE: 'Hidden',
  UNHIDE: 'Shown',
  INVALIDATE: 'Invalidated',
  ASSIGN: 'Assigned',
  MOVE: 'Moved',
  EXIT: 'Exited',
  LEAVE_START: 'Leave started',
  LEAVE_RETURN: 'Returned',
  PASSWORD_CHANGE: 'Password changed',
  IMPORT: 'Imported',
};

/** Entity types as stored, with the label shown in filters. */
export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  Worker: 'Worker',
  BedAssignment: 'Bed stay',
  Leave: 'Leave',
  Camp: 'Camp',
  Room: 'Room',
  Bed: 'Bed',
  Role: 'Role',
  User: 'User',
  FieldDefinition: 'Custom field',
  SponsorEntity: 'Sponsor',
  ClientCompany: 'Client',
  Department: 'Division',
  Import: 'Excel import',
};

const isoDate = z.string().refine(isIsoDate, 'Use a valid date (YYYY-MM-DD)');
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const auditQuerySchema = z.object({
  /** Dubai calendar dates, inclusive. */
  from: z.preprocess(emptyToUndefined, isoDate.optional()),
  to: z.preprocess(emptyToUndefined, isoDate.optional()),
  actorId: z.preprocess(emptyToUndefined, z.string().regex(/^[0-9a-f]{24}$/i).optional()),
  action: z.preprocess(emptyToUndefined, z.enum(AUDIT_ACTIONS).optional()),
  entityType: z.preprocess(emptyToUndefined, z.string().max(40).optional()),
  /** Worker name / Emp No, camp name or room number. */
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  /** Keyset pagination: id of the last entry already shown. */
  cursor: z.preprocess(emptyToUndefined, z.string().regex(/^[0-9a-f]{24}$/i).optional()),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(50)),
});
export type AuditQuery = z.output<typeof auditQuerySchema>;

export interface AuditChangeDto {
  field: string;
  before: string | null;
  after: string | null;
}

export interface AuditEntryDto {
  id: string;
  at: string;
  actorName: string | null;
  action: AuditAction | string;
  entityType: string;
  /** What it was about, e.g. a worker's name or "Room 101 · Al Quoz Camp". */
  subject: string;
  /** Where the subject can be opened, if anywhere. */
  href: string | null;
  /** One-line description of what happened. */
  detail: string;
  changes: AuditChangeDto[];
}

export interface AuditPageDto {
  entries: AuditEntryDto[];
  /** Pass as `cursor` to load older entries; null when there are none. */
  nextCursor: string | null;
}

export interface AuditMetaDto {
  users: { id: string; name: string }[];
  entityTypes: { value: string; label: string }[];
  today: string;
}
