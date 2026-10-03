/** Worker request schemas, list query and response shapes (shared by backend and frontend). */
import { z } from 'zod';
import { isIsoDate } from './dates.js';
import { EXIT_STATUSES, WORKER_STATUS_LABELS, WORKER_STATUSES, type BedType, type WorkerStatus } from './domain/worker-status.js';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id');
const isoDate = z.string().refine(isIsoDate, 'Use a valid date (YYYY-MM-DD)');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

/** Built-in editable worker fields. Status/exit are changed only through the exit flow. */
export const workerInputSchema = z.object({
  employeeCode: z.string().trim().min(1, 'Emp No is required').max(30).transform((v) => v.toUpperCase()),
  fullName: z.string().trim().min(1, 'Name is required').max(120),
  designation: optionalText(120),
  nationality: optionalText(60),
  uaePhone: optionalText(30),
  homePhone: optionalText(30),
  email: z
    .union([z.literal(''), z.email('Enter a valid email')])
    .transform((v) => (v === '' ? null : v.toLowerCase()))
    .nullable()
    .optional(),
  joinDate: z
    .union([z.literal(''), isoDate])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  remarks: optionalText(500),
  sponsorEntityId: objectId.nullable().optional(),
  clientCompanyId: objectId.nullable().optional(),
  departmentId: objectId.nullable().optional(),
  /** Only stored for users with workers.viewIdentity; ignored otherwise. */
  passportNumber: optionalText(30),
  emiratesIdNumber: optionalText(30),
  /** Custom field values keyed by field key. Validated against field definitions on the server. */
  customFields: z.record(z.string(), z.unknown()).default({}),
});
export type WorkerInput = z.input<typeof workerInputSchema>;
export type WorkerInputParsed = z.output<typeof workerInputSchema>;

export const workerExitSchema = z.object({
  status: z.enum(EXIT_STATUSES),
  exitDate: isoDate,
  reason: z.string().trim().max(300).optional().default(''),
});
export type WorkerExitInput = z.input<typeof workerExitSchema>;

export const leaveStartSchema = z.object({ note: z.string().trim().max(300).optional().default('') });

// ───────── List query ─────────

export const WORKER_SORT_FIELDS = ['employeeCode', 'fullName', 'designation', 'nationality', 'joinDate', 'status'] as const;
export type WorkerSortField = (typeof WORKER_SORT_FIELDS)[number];

export const WORKER_STATUS_FILTERS = ['ACTIVE', 'EXITED', 'ALL', ...WORKER_STATUSES] as const;
export const LEAVE_FILTERS = ['ALL', 'PRESENT', 'ON_LEAVE'] as const;
export const HOUSING_FILTERS = ['ALL', 'HOUSED', 'UNHOUSED'] as const;

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const workerListQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  clientId: z.preprocess(emptyToUndefined, objectId.optional()),
  departmentId: z.preprocess(emptyToUndefined, objectId.optional()),
  campId: z.preprocess(emptyToUndefined, objectId.optional()),
  status: z.preprocess(emptyToUndefined, z.enum(WORKER_STATUS_FILTERS).default('ACTIVE')),
  leave: z.preprocess(emptyToUndefined, z.enum(LEAVE_FILTERS).default('ALL')),
  housing: z.preprocess(emptyToUndefined, z.enum(HOUSING_FILTERS).default('ALL')),
  sort: z.preprocess(emptyToUndefined, z.enum(WORKER_SORT_FIELDS).default('employeeCode')),
  dir: z.preprocess(emptyToUndefined, z.enum(['asc', 'desc']).default('asc')),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
  pageSize: z.preprocess(emptyToUndefined, z.coerce.number().int().min(10).max(200).default(50)),
});
export type WorkerListQuery = z.output<typeof workerListQuerySchema>;

// ───────── Responses ─────────

/** Accommodation status shown in the employee table (like the camp occupancy sheet). */
export const ACCOMMODATION_STATUSES = ['OCCUPIED', 'ON_LEAVE', 'NOT_HOUSED', 'EXITED'] as const;
export type AccommodationStatus = (typeof ACCOMMODATION_STATUSES)[number];
export const ACCOMMODATION_STATUS_LABELS: Record<AccommodationStatus, string> = {
  OCCUPIED: 'Occupied',
  ON_LEAVE: 'On leave',
  NOT_HOUSED: 'No bed',
  EXITED: 'Exited',
};

export function accommodationStatus(input: {
  status: WorkerStatus;
  housed: boolean;
  onLeave: boolean;
}): AccommodationStatus {
  if (input.status !== 'ACTIVE') return 'EXITED';
  if (input.onLeave) return 'ON_LEAVE';
  return input.housed ? 'OCCUPIED' : 'NOT_HOUSED';
}

export interface WorkerHousingDto {
  assignmentId: string;
  campId: string;
  campName: string;
  roomId: string;
  roomNumber: string;
  bedId: string;
  bedLabel: string;
  bedType: BedType | null;
  since: string;
}

export interface WorkerRowDto {
  id: string;
  employeeCode: string;
  fullName: string;
  designation: string | null;
  nationality: string | null;
  uaePhone: string | null;
  homePhone: string | null;
  email: string | null;
  joinDate: string | null;
  status: WorkerStatus;
  exitDate: string | null;
  exitReason: string | null;
  remarks: string | null;
  sponsorEntityId: string | null;
  sponsorName: string | null;
  clientCompanyId: string | null;
  clientName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  /** Present only for users with workers.viewIdentity. */
  passportNumber?: string | null;
  emiratesIdNumber?: string | null;
  customFields: Record<string, unknown>;
  housing: WorkerHousingDto | null;
  leave: { id: string; since: string; note: string | null } | null;
  accommodationStatus: AccommodationStatus;
}

export interface WorkerListDto {
  rows: WorkerRowDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkerMetaDto {
  /** Hidden entries are included so existing workers still show them; forms offer them only when already selected. */
  sponsors: { id: string; name: string; isHidden: boolean }[];
  clients: { id: string; name: string; isHidden: boolean; departments: { id: string; name: string; isHidden: boolean }[] }[];
  camps: { id: string; name: string; isActive: boolean }[];
}

export interface BedStayDto {
  id: string;
  campName: string;
  roomNumber: string;
  bedLabel: string;
  startDate: string;
  endDate: string | null;
  endReason: 'MOVED' | 'EXITED' | null;
  invalidated: boolean;
  createdByName: string | null;
  endedByName: string | null;
}

export interface LeaveRecordDto {
  id: string;
  startDate: string;
  returnDate: string | null;
  closedByExit: boolean;
  note: string | null;
}

export interface WorkerDetailDto extends WorkerRowDto {
  stays: BedStayDto[];
  leaves: LeaveRecordDto[];
  createdAt: string;
  updatedAt: string;
}

/** Display value of a built-in field for one worker row (used by exports and reports). */
export function systemFieldValue(row: WorkerRowDto, key: string): string | null {
  switch (key) {
    case 'camp':
      return row.housing?.campName ?? null;
    case 'room_no':
      return row.housing?.roomNumber ?? null;
    case 'bed':
      return row.housing?.bedLabel ?? null;
    case 'accommodation_status':
      return ACCOMMODATION_STATUS_LABELS[row.accommodationStatus];
    case 'employee_code':
      return row.employeeCode;
    case 'full_name':
      return row.fullName;
    case 'designation':
      return row.designation;
    case 'department':
      return row.departmentName;
    case 'client_company':
      return row.clientName;
    case 'sponsor_entity':
      return row.sponsorName;
    case 'uae_phone':
      return row.uaePhone;
    case 'home_phone':
      return row.homePhone;
    case 'email':
      return row.email;
    case 'nationality':
      return row.nationality;
    case 'join_date':
      return row.joinDate;
    case 'status':
      return WORKER_STATUS_LABELS[row.status];
    case 'exit_date':
      return row.exitDate;
    case 'exit_reason':
      return row.exitReason;
    case 'passport_number':
      return row.passportNumber ?? null;
    case 'emirates_id_number':
      return row.emiratesIdNumber ?? null;
    case 'remarks':
      return row.remarks;
    default:
      return null;
  }
}
