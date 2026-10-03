import { describe, expect, it } from 'vitest';
import { buildCustomFields, normalizeCustomValue, type CustomFieldDef } from './custom-values.js';

const def = (over: Partial<CustomFieldDef>): CustomFieldDef => ({
  key: 'f',
  label: 'F',
  type: 'TEXT',
  options: [],
  required: false,
  isHidden: false,
  ...over,
});

describe('normalizeCustomValue', () => {
  it('treats blanks as no value', () => {
    expect(normalizeCustomValue(def({}), '  ')).toBeUndefined();
    expect(normalizeCustomValue(def({}), null)).toBeUndefined();
  });

  it('validates each type', () => {
    expect(normalizeCustomValue(def({ type: 'NUMBER' }), '42')).toBe(42);
    expect(() => normalizeCustomValue(def({ type: 'NUMBER' }), 'abc')).toThrow();
    expect(normalizeCustomValue(def({ type: 'DATE' }), '2026-10-02')).toBe('2026-10-02');
    expect(() => normalizeCustomValue(def({ type: 'DATE' }), '02/10/2026')).toThrow();
    expect(normalizeCustomValue(def({ type: 'SELECT', options: ['A', 'B'] }), 'B')).toBe('B');
    expect(() => normalizeCustomValue(def({ type: 'SELECT', options: ['A'] }), 'Z')).toThrow();
    expect(normalizeCustomValue(def({ type: 'EMAIL' }), 'A@B.CO')).toBe('a@b.co');
    expect(() => normalizeCustomValue(def({ type: 'PHONE' }), 'call me')).toThrow();
    expect(normalizeCustomValue(def({ type: 'PHONE' }), '+971 50 123 4567')).toBe('+971 50 123 4567');
    expect(normalizeCustomValue(def({ type: 'BOOLEAN' }), false)).toBe(false);
  });
});

describe('buildCustomFields', () => {
  const defs = [
    def({ key: 'shoe', label: 'Shoe', type: 'NUMBER', required: true }),
    def({ key: 'locker', label: 'Locker' }),
    def({ key: 'old', label: 'Old', isHidden: true }),
  ];

  it('normalises, drops blanks and keeps hidden values', () => {
    const { values, errors } = buildCustomFields(defs, { shoe: '42', locker: ' ' }, { old: 'keep', locker: 'L1' });
    expect(errors).toEqual([]);
    expect(values).toEqual({ shoe: 42, old: 'keep' });
  });

  it('reports missing required fields and unknown keys', () => {
    const { errors } = buildCustomFields(defs, { bogus: 1 });
    expect(errors).toEqual(['Unknown field "bogus"', 'Shoe is required']);
  });

  it('hidden fields cannot be changed through the form', () => {
    const { values } = buildCustomFields(defs, { shoe: 1, old: 'new' }, { old: 'keep' });
    expect(values.old).toBe('keep');
  });
});
