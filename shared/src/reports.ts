import { z } from 'zod';
import { isIsoDate } from './dates.js';
import { EXIT_STATUSES } from './domain/worker-status.js';
import { SYSTEM_FIELDS } from './fields.js';

/**
 * Reports: five fixed report types. Worker-based reports let the user pick columns from every built-in
 * field (identity numbers only with workers.viewIdentity), every visible custom field (`custom:<key>`) and
 * a few report-specific columns. The vacancy list has fixed columns (beds have no worker).
 */
export const REPORT_TYPES = ['occupancy', 'workers_by_client', 'on_leave', 'exits', 'vacancy'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_INFO: Record<ReportType, { title: string; description: string }> = {
  occupancy: { title: 'Camp occupancy sheet', description: 'Every bed by room, with who is in it' },
  workers_by_client: { title: 'Workers by client / division', description: 'Headcount and list per client' },
  on_leave: { title: 'On-leave list', description: 'Who is away and which bed is held' },
  exits: { title: 'Exits in a period', description: 'Exits by type between two dates' },
  vacancy: { title: 'Vacancy list', description: 'Free beds, ready to assign' },
};

/** Columns that only exist in one report (computed from bed, leave or stay history). */
export const REPORT_EXTRA_COLUMNS: Record<ReportType, { key: string; label: string }[]> = {
  occupancy: [],
  workers_by_client: [],
  on_leave: [
    { key: 'leave_since', label: 'Leave since' },
    { key: 'days_away', label: 'Days away' },
    { key: 'leave_note', label: 'Leave note' },
  ],
  exits: [{ key: 'last_bed', label: 'Last bed' }],
  vacancy: [
    { key: 'camp', label: 'Camp' },
    { key: 'room_no', label: 'Room No' },
    { key: 'bed', label: 'Bed' },
    { key: 'bed_type', label: 'Bed type' },
    { key: 'vacant_since', label: 'Vacant since' },
  ],
};

/** Columns ticked when a report is first opened (the user can change and reorder them). */
export const REPORT_DEFAULT_COLUMNS: Record<ReportType, string[]> = {
  occupancy: ['bed', 'employee_code', 'full_name', 'designation', 'client_company', 'nationality', 'accommodation_status'],
  workers_by_client: ['employee_code', 'full_name', 'designation', 'department', 'camp', 'room_no', 'bed', 'accommodation_status'],
  on_leave: ['employee_code', 'full_name', 'client_company', 'camp', 'room_no', 'bed', 'leave_since', 'days_away'],
  exits: ['employee_code', 'full_name', 'client_company', 'status', 'exit_date', 'exit_reason', 'last_bed'],
  vacancy: ['camp', 'room_no', 'bed', 'bed_type', 'vacant_since'],
};

const isoDate = z.string().refine(isIsoDate, 'Use a valid date (YYYY-MM-DD)');
const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id');
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const optionalId = z.preprocess(emptyToUndefined, objectId.optional());
const optionalDate = z.preprocess(emptyToUndefined, isoDate.optional());

export const reportQuerySchema = z.object({
  type: z.enum(REPORT_TYPES),
  campId: optionalId,
  clientId: optionalId,
  departmentId: optionalId,
  /** Occupancy, on-leave and vacancy are computed as of this Dubai date (default today). */
  asOf: optionalDate,
  /** Exits: inclusive period. */
  from: optionalDate,
  to: optionalDate,
  exitStatus: z.preprocess(emptyToUndefined, z.enum(EXIT_STATUSES).optional()),
  /** Occupancy: list vacant beds as empty rows. */
  includeVacant: z.preprocess((v) => (v === undefined || v === '' ? undefined : v === true || v === 'true' || v === '1'), z.boolean().default(true)),
  /** Comma-separated column keys, in display order. Empty = report defaults. */
  columns: z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v),
    z.array(z.string().max(80)).max(80).optional(),
  ),
  /** Preview only: max rows returned (export ignores it). */
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(5000).optional()),
});
export type ReportQuery = z.output<typeof reportQuerySchema>;

export interface ReportColumnDto {
  key: string;
  label: string;
}

/** `held` = on leave (bed kept), `vacant` = empty bed row, `exited` = exited worker. */
export type ReportRowTone = 'held' | 'vacant' | 'exited' | null;

export interface ReportRowDto {
  cells: (string | null)[];
  tone: ReportRowTone;
}

export interface ReportGroupDto {
  label: string;
  summary: string;
  rows: ReportRowDto[];
}

export interface ReportDto {
  type: ReportType;
  title: string;
  subtitle: string;
  columns: ReportColumnDto[];
  groups: ReportGroupDto[];
  totalRows: number;
  /** Rows actually included (preview may be cut at `limit`). */
  shownRows: number;
}

/** Everything the report builder needs to draw its controls. */
export interface ReportMetaDto {
  camps: { id: string; name: string }[];
  clients: { id: string; name: string; departments: { id: string; name: string }[] }[];
  /** Columns the current user may pick for worker reports (built-in + visible custom), in default order. */
  columns: (ReportColumnDto & { group: 'builtin' | 'custom' })[];
  today: string;
}

/** Built-in column keys that a report can show; identity numbers are filtered by permission server-side. */
export const REPORT_SYSTEM_COLUMN_KEYS: readonly string[] = SYSTEM_FIELDS.map((f) => f.key);
