/**
 * Excel worker import: column mapping, value parsing and request/response shapes.
 * The backend turns the uploaded file into a grid of strings; the browser maps columns to fields;
 * the backend validates (dry run) and then imports in small chunks, one transaction per row.
 */
import { z } from 'zod';
import { isIsoDate } from './dates.js';
import { EXIT_STATUSES, WORKER_STATUS_LABELS, type ExitStatus } from './domain/worker-status.js';
import type { FieldType } from './fields.js';

/** Built-in fields a column can be imported into (derived housing fields are excluded). */
export const IMPORT_FIELDS = [
  { key: 'employee_code', label: 'Emp No', required: true },
  { key: 'full_name', label: 'Name', required: true },
  { key: 'designation', label: 'Position' },
  { key: 'department', label: 'Division' },
  { key: 'client_company', label: 'Client' },
  { key: 'sponsor_entity', label: 'Sponsor' },
  { key: 'uae_phone', label: 'UAE Contact No' },
  { key: 'home_phone', label: 'Home Country Contact No' },
  { key: 'email', label: 'Email ID' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'join_date', label: 'Join Date' },
  { key: 'status', label: 'Employment Status' },
  { key: 'exit_date', label: 'Exit Date' },
  { key: 'exit_reason', label: 'Exit Reason' },
  { key: 'passport_number', label: 'Passport No', identity: true },
  { key: 'emirates_id_number', label: 'Emirates ID No', identity: true },
  { key: 'remarks', label: 'Remarks' },
] as const satisfies readonly { key: string; label: string; required?: boolean; identity?: boolean }[];
export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]['key'];
const IMPORT_FIELD_KEYS: ReadonlySet<string> = new Set(IMPORT_FIELDS.map((f) => f.key));

export function isImportFieldKey(target: string): target is ImportFieldKey {
  return IMPORT_FIELD_KEYS.has(target);
}

/** Column targets: a built-in key, `custom:<key>`, `new:<index into newFields>`, or `skip`. */
export const SKIP_TARGET = 'skip';
export const customTarget = (key: string) => `custom:${key}`;
export const newFieldTarget = (index: number) => `new:${index}`;
export function parseTarget(
  target: string,
): { kind: 'skip' } | { kind: 'field'; key: ImportFieldKey } | { kind: 'custom'; key: string } | { kind: 'new'; index: number } | null {
  if (target === SKIP_TARGET) return { kind: 'skip' };
  if (isImportFieldKey(target)) return { kind: 'field', key: target };
  if (target.startsWith('custom:') && target.length > 7) return { kind: 'custom', key: target.slice(7) };
  const m = /^new:(\d{1,3})$/.exec(target);
  if (m) return { kind: 'new', index: Number(m[1]) };
  return null;
}

/** Statuses a row can be imported with. ON_LEAVE = active + an open leave from the import day. */
export const IMPORT_STATUSES = ['ACTIVE', 'ON_LEAVE', ...EXIT_STATUSES] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];
export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  ...WORKER_STATUS_LABELS,
  ON_LEAVE: 'Active, on leave',
};
export function isImportExit(status: ImportStatus): status is ExitStatus {
  return (EXIT_STATUSES as readonly string[]).includes(status);
}

/** New custom fields can be any type except Dropdown (which needs an option list). */
export const IMPORT_NEW_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'PHONE', 'EMAIL', 'BOOLEAN'] as const satisfies readonly FieldType[];
export type ImportNewFieldType = (typeof IMPORT_NEW_FIELD_TYPES)[number];

// ───────── Matching headers and values ─────────

/** "EMPLOYEE ID NO ", "Employee-ID No." and "employee id no" all become "employee id no". */
export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SYNONYMS: Record<ImportFieldKey, string[]> = {
  employee_code: ['employee id no', 'employee id', 'emp no', 'emp id', 'employee no', 'employee number', 'employee code', 'emp code', 'staff id', 'staff no', 'staff code'],
  full_name: ['name', 'employee name', 'full name', 'worker name', 'staff name', 'name of employee'],
  designation: ['position', 'designation', 'job title', 'title', 'trade', 'occupation'],
  department: ['division', 'department', 'dept'],
  client_company: ['client', 'client company', 'client name', 'company'],
  sponsor_entity: ['sponsor', 'sponsor entity', 'visa sponsor', 'sponsor name'],
  uae_phone: ['uae contact no', 'uae contact number', 'contact number', 'contact no', 'mobile', 'mobile no', 'mobile number', 'phone', 'phone no', 'phone number', 'uae mobile'],
  home_phone: ['home country contact no', 'home country contact number', 'home contact', 'home contact no', 'home phone', 'home number'],
  email: ['email', 'email id', 'e mail', 'email address', 'mail'],
  nationality: ['nationality', 'country'],
  join_date: ['join date', 'date of joining', 'doj', 'joining date', 'date joined', 'joined on'],
  status: ['employment status', 'status', 'emp status', 'employee status'],
  exit_date: ['exit date', 'date of exit', 'last working day', 'lwd', 'resignation date', 'termination date'],
  exit_reason: ['exit reason', 'reason for exit', 'reason of exit'],
  passport_number: ['passport no', 'passport number', 'passport'],
  emirates_id_number: ['emirates id no', 'emirates id number', 'emirates id', 'eid no', 'eid number', 'eid'],
  remarks: ['remarks', 'remark', 'notes', 'note', 'comments'],
};

const SYNONYM_INDEX: ReadonlyMap<string, ImportFieldKey> = new Map(
  IMPORT_FIELDS.flatMap((f) => [normalizeHeader(f.label), ...SYNONYMS[f.key]].map((s) => [s, f.key] as const)),
);

/**
 * Suggested target for every header: built-in synonyms first, then visible custom field labels, else skip.
 * Each target is suggested at most once (the first matching column wins).
 */
export function suggestMapping(headers: readonly string[], customFields: readonly { key: string; label: string; isHidden: boolean }[]): string[] {
  const custom = new Map(customFields.filter((f) => !f.isHidden).map((f) => [normalizeHeader(f.label), customTarget(f.key)]));
  const used = new Set<string>();
  return headers.map((header) => {
    const h = normalizeHeader(header);
    const target = (h && (SYNONYM_INDEX.get(h) ?? custom.get(h))) || SKIP_TARGET;
    if (target === SKIP_TARGET || used.has(target)) return SKIP_TARGET;
    used.add(target);
    return target;
  });
}

/** Key used for the status value map: trimmed, upper-case, single spaces. */
export function statusKey(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Best guess for a status written in a spreadsheet ("RESIGNATION", "ANNUAL LEAVE", "Absconding"…). */
export function suggestStatus(raw: string): ImportStatus | null {
  const v = statusKey(raw);
  if (!v) return 'ACTIVE';
  if (/^(ACTIVE|WORKING|IN ?SERVICE|PRESENT|ON DUTY)$/.test(v)) return 'ACTIVE';
  if (v.includes('LEAVE') || v.includes('VACATION')) return 'ON_LEAVE';
  if (v.startsWith('RESIGN')) return 'RESIGNED';
  if (v.startsWith('TERMINAT')) return 'TERMINATED';
  if (v.startsWith('ABSCOND')) return 'ABSCONDED';
  if (v.includes('VISA') && v.includes('CANCEL')) return 'VISA_CANCELLED';
  if (v.includes('TRANSFER')) return 'TRANSFERRED_OUT';
  return null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const fullYear = (y: number) => (y >= 100 ? y : y < 70 ? 2000 + y : 1900 + y);

/**
 * Calendar date from a spreadsheet value: "2019-08-06" (what the backend produces for date cells),
 * "06-Aug-19", "6 Aug 2019", "06/08/2019", "6.8.2019" (day first, as written in the UAE). Null if not a date.
 */
export function parseImportDate(raw: string): string | null {
  const v = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(v);
  if (m) return checked(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-\s/.]([a-z]{3})[a-z]*\.?[-\s/.,]+(\d{2}|\d{4})$/i.exec(v);
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    return month ? checked(fullYear(Number(m[3])), month, Number(m[1])) : null;
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(v);
  if (m) return checked(fullYear(Number(m[3])), Number(m[2]), Number(m[1]));
  return null;
}
function checked(y: number, mo: number, d: number): string | null {
  const iso = `${y}-${pad(mo)}-${pad(d)}`;
  return isIsoDate(iso) ? iso : null;
}

export function parseImportBoolean(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(v)) return true;
  if (['no', 'n', 'false', '0'].includes(v)) return false;
  return null;
}

/** "3,500.00" -> 3500. Null if not a number. */
export function parseImportNumber(raw: string): number | null {
  const v = raw.trim().replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(v)) return null;
  return Number(v);
}

/**
 * Field type guessed from a column's values, for "Create new custom field".
 * Long digit strings (MOL ID, labour card, account numbers) stay Text: they are identifiers, not amounts.
 */
export function guessFieldType(values: readonly string[]): ImportNewFieldType {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  if (!filled.length) return 'TEXT';
  if (filled.every((v) => parseImportDate(v))) return 'DATE';
  if (filled.every((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) return 'EMAIL';
  if (filled.every((v) => parseImportBoolean(v) !== null && !/^[01]$/.test(v))) return 'BOOLEAN';
  if (filled.every((v) => /^(\+|00)?971[\d\s-]{8,12}$/.test(v) || /^\+[\d\s()-]{7,20}$/.test(v))) return 'PHONE';
  if (filled.every((v) => parseImportNumber(v) !== null && v.replace(/[^\d]/g, '').length < 9 && !/^0\d/.test(v))) return 'NUMBER';
  return 'TEXT';
}

/**
 * Header row of a sheet (1-based): the first of the top 20 rows holding mostly text labels.
 * Skips title/date rows above the real headers.
 */
export function detectHeaderRow(rows: readonly (readonly string[])[]): number {
  const score = (row: readonly string[]) =>
    row.filter((c) => c.trim() && !parseImportDate(c) && parseImportNumber(c) === null).length;
  const top = rows.slice(0, 20);
  const best = Math.max(0, ...top.map(score));
  if (best === 0) return 1;
  const index = top.findIndex((row) => score(row) >= Math.max(2, Math.ceil(best * 0.6)));
  return index + 1;
}

// ───────── Requests ─────────

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id');
const isoDate = z.string().refine(isIsoDate, 'Use a valid date (YYYY-MM-DD)');

export const importNewFieldSchema = z.object({
  label: z.string().trim().min(1, 'Field name is required').max(60),
  type: z.enum(IMPORT_NEW_FIELD_TYPES),
});
export type ImportNewField = z.output<typeof importNewFieldSchema>;

export const importOptionsSchema = z.object({
  /** Sheet column (0-based) and what it is imported as. Columns not listed are not imported. */
  columns: z.array(z.object({ index: z.number().int().min(0).max(499), target: z.string().max(80) })).max(500),
  newFields: z.array(importNewFieldSchema).max(100).default([]),
  /** Used for every row when no Client / Sponsor column is mapped. */
  clientId: objectId.nullable().optional(),
  sponsorId: objectId.nullable().optional(),
  /** What to do when the Emp No already exists in the app. */
  duplicateMode: z.enum(['SKIP', 'UPDATE']).default('SKIP'),
  /** Exit date for exited rows without one in the file. */
  defaultExitDate: isoDate.nullable().optional(),
  /** Spreadsheet status value (see statusKey) -> import status. Blank status = Active. */
  statusMap: z.record(z.string(), z.enum(IMPORT_STATUSES)).default({}),
  /** Validation only: treat divisions missing under the client as "will be created". */
  createDivisions: z.boolean().default(false),
});
export type ImportOptions = z.input<typeof importOptionsSchema>;
export type ImportOptionsParsed = z.output<typeof importOptionsSchema>;

const importRowSchema = z.object({
  /** Row number in the spreadsheet, shown in messages. */
  rowNumber: z.number().int().min(1),
  cells: z.array(z.string().max(2000)).max(500),
});
export type ImportRow = z.output<typeof importRowSchema>;

export const IMPORT_MAX_ROWS = 5000;
/**
 * Rows per commit request. Each row is its own transaction with several database round trips, and the rows of a
 * chunk are saved in parallel, so a chunk stays far below the hosting timeout (Heroku: 30 s) even with a remote DB.
 */
export const IMPORT_CHUNK_SIZE = 10;

export const importValidateSchema = z.object({
  options: importOptionsSchema,
  rows: z.array(importRowSchema).max(IMPORT_MAX_ROWS),
});
export type ImportValidateInput = z.output<typeof importValidateSchema>;

export const importSetupSchema = z.object({
  newFields: z.array(importNewFieldSchema).max(100).default([]),
  divisions: z.array(z.object({ clientId: objectId, name: z.string().trim().min(1).max(100) })).max(500).default([]),
});
export type ImportSetupInput = z.output<typeof importSetupSchema>;

export const importCommitSchema = z.object({
  /** Same id for every chunk of one import (groups the audit entries). */
  importId: objectId,
  fileName: z.string().trim().max(200).default(''),
  options: importOptionsSchema,
  rows: z.array(importRowSchema).max(IMPORT_CHUNK_SIZE),
});
export type ImportCommitInput = z.output<typeof importCommitSchema>;

// ───────── Responses ─────────

export interface ImportSheetDto {
  name: string;
  /** Suggested header row, 1-based. */
  headerRow: number;
  /** Every row from row 1 to the last row with data; rows[i] is spreadsheet row i + 1. */
  rows: string[][];
}
export interface ImportParseDto {
  fileName: string;
  sheets: ImportSheetDto[];
}

export const IMPORT_OUTCOMES = ['CREATE', 'UPDATE', 'SKIP', 'ERROR'] as const;
export type ImportOutcome = (typeof IMPORT_OUTCOMES)[number];
export const IMPORT_OUTCOME_LABELS: Record<ImportOutcome, string> = {
  CREATE: 'New',
  UPDATE: 'Update',
  SKIP: 'Skipped',
  ERROR: 'Error',
};

export interface ImportRowResultDto {
  rowNumber: number;
  employeeCode: string | null;
  name: string | null;
  outcome: ImportOutcome;
  status: ImportStatus | null;
  errors: string[];
  warnings: string[];
}

export interface ImportValidateDto {
  results: ImportRowResultDto[];
  counts: Record<ImportOutcome, number>;
  /** Divisions named in the file that do not exist under their client yet. */
  missingDivisions: { clientId: string; clientName: string; name: string; rows: number }[];
}

export interface ImportSetupDto {
  /** Storage key of each requested new field, in the same order. */
  fieldKeys: string[];
  divisionsCreated: number;
}

export interface ImportCommitDto {
  results: ImportRowResultDto[];
}

export function countOutcomes(results: readonly { outcome: ImportOutcome }[]): Record<ImportOutcome, number> {
  const counts: Record<ImportOutcome, number> = { CREATE: 0, UPDATE: 0, SKIP: 0, ERROR: 0 };
  for (const r of results) counts[r.outcome]++;
  return counts;
}
