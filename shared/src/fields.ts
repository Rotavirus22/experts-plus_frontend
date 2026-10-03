import type { Permission } from './permissions.js';

/**
 * Worker fields.
 * - SYSTEM fields are built in: they can never be deleted or hidden, and every one is available in reports.
 * - CUSTOM fields are created by admins. A custom field can be deleted only while no worker has a value
 *   for it; once any data exists it can only be hidden (data is kept).
 */
export const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'PHONE', 'EMAIL', 'BOOLEAN'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  DATE: 'Date',
  SELECT: 'Dropdown',
  PHONE: 'Phone',
  EMAIL: 'Email',
  BOOLEAN: 'Yes / No',
};

export interface SystemFieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Derived fields come from camp/bed/leave data and are read-only on the worker form. */
  derived: boolean;
  /** Permission required to see the value (sensitive identity numbers). */
  requires?: Permission;
}

/** Order follows the camp occupancy sheet: Room No, Status, Emp No, Name, Position, Division, contacts, Nationality, Remarks. */
export const SYSTEM_FIELDS: readonly SystemFieldDef[] = [
  { key: 'camp', label: 'Camp', type: 'TEXT', derived: true },
  { key: 'room_no', label: 'Room No', type: 'TEXT', derived: true },
  { key: 'bed', label: 'Bed', type: 'TEXT', derived: true },
  { key: 'accommodation_status', label: 'Status', type: 'TEXT', derived: true },
  { key: 'employee_code', label: 'Emp No', type: 'TEXT', derived: false },
  { key: 'full_name', label: 'Name', type: 'TEXT', derived: false },
  { key: 'designation', label: 'Position', type: 'TEXT', derived: false },
  { key: 'department', label: 'Division', type: 'SELECT', derived: false },
  { key: 'client_company', label: 'Client', type: 'SELECT', derived: false },
  { key: 'sponsor_entity', label: 'Sponsor', type: 'SELECT', derived: false },
  { key: 'uae_phone', label: 'UAE Contact No', type: 'PHONE', derived: false },
  { key: 'home_phone', label: 'Home Country Contact No', type: 'PHONE', derived: false },
  { key: 'email', label: 'Email ID', type: 'EMAIL', derived: false },
  { key: 'nationality', label: 'Nationality', type: 'TEXT', derived: false },
  { key: 'join_date', label: 'Join Date', type: 'DATE', derived: false },
  { key: 'status', label: 'Employment Status', type: 'SELECT', derived: false },
  { key: 'exit_date', label: 'Exit Date', type: 'DATE', derived: false },
  { key: 'exit_reason', label: 'Exit Reason', type: 'TEXT', derived: false },
  { key: 'passport_number', label: 'Passport No', type: 'TEXT', derived: false, requires: 'workers.viewIdentity' },
  { key: 'emirates_id_number', label: 'Emirates ID No', type: 'TEXT', derived: false, requires: 'workers.viewIdentity' },
  { key: 'remarks', label: 'Remarks', type: 'TEXT', derived: false },
];

export const SYSTEM_FIELD_KEYS: ReadonlySet<string> = new Set(SYSTEM_FIELDS.map((f) => f.key));

export function isSystemFieldKey(key: string): boolean {
  return SYSTEM_FIELD_KEYS.has(key);
}

const SYSTEM_LABELS: ReadonlySet<string> = new Set(SYSTEM_FIELDS.map((f) => f.label.trim().toLowerCase()));

/** True if a custom field with this label would clash with a built-in field's key or label. */
export function clashesWithSystemField(label: string, key: string): boolean {
  return isSystemFieldKey(key) || SYSTEM_LABELS.has(label.trim().replace(/\s+/g, ' ').toLowerCase());
}

/** A custom-field value counts as "data" unless it is null, undefined or an empty/whitespace string. */
export function hasFieldValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}
