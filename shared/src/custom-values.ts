/**
 * Validation and normalisation of custom field values (used by the backend on save,
 * and by the frontend to show errors early).
 */
import { isIsoDate } from './dates.js';
import { hasFieldValue, type FieldType } from './fields.js';

export interface CustomFieldDef {
  key: string;
  label: string;
  type: FieldType;
  options: string[];
  required: boolean;
  isHidden: boolean;
}

export type CustomValue = string | number | boolean;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s()-]{5,30}$/;

/** Normalises one value. Returns undefined for "no value"; throws a message string when invalid. */
export function normalizeCustomValue(def: CustomFieldDef, raw: unknown): CustomValue | undefined {
  if (!hasFieldValue(raw)) return undefined;
  switch (def.type) {
    case 'TEXT': {
      const v = String(raw).trim();
      if (v.length > 500) throw `${def.label} is too long`;
      return v;
    }
    case 'NUMBER': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isFinite(n)) throw `${def.label} must be a number`;
      return n;
    }
    case 'DATE': {
      const v = String(raw).trim();
      if (!isIsoDate(v)) throw `${def.label} must be a valid date`;
      return v;
    }
    case 'SELECT': {
      const v = String(raw).trim();
      if (!def.options.includes(v)) throw `${def.label}: "${v}" is not one of the options`;
      return v;
    }
    case 'PHONE': {
      const v = String(raw).trim();
      if (!PHONE_RE.test(v)) throw `${def.label} must be a phone number`;
      return v;
    }
    case 'EMAIL': {
      const v = String(raw).trim().toLowerCase();
      if (!EMAIL_RE.test(v)) throw `${def.label} must be an email address`;
      return v;
    }
    case 'BOOLEAN': {
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true' || raw === 'yes') return true;
      if (raw === 'false' || raw === 'no') return false;
      throw `${def.label} must be yes or no`;
    }
  }
}

/**
 * Builds the customFields object to store.
 * - Unknown keys are rejected.
 * - Hidden fields keep their existing values (they are not shown on the form).
 * - Blank values are removed (never stored), so "has data" = key present.
 * - Required visible fields must have a value.
 */
export function buildCustomFields(
  defs: readonly CustomFieldDef[],
  submitted: Record<string, unknown>,
  existing: Record<string, unknown> = {},
): { values: Record<string, CustomValue>; errors: string[] } {
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const errors: string[] = [];
  const values: Record<string, CustomValue> = {};

  for (const key of Object.keys(submitted)) {
    if (!byKey.has(key)) errors.push(`Unknown field "${key}"`);
  }

  for (const def of defs) {
    if (def.isHidden) {
      const kept = existing[def.key];
      if (hasFieldValue(kept)) values[def.key] = kept as CustomValue;
      continue;
    }
    try {
      const v = normalizeCustomValue(def, submitted[def.key]);
      if (v === undefined) {
        if (def.required) errors.push(`${def.label} is required`);
      } else {
        values[def.key] = v;
      }
    } catch (message) {
      errors.push(String(message));
    }
  }
  return { values, errors };
}
