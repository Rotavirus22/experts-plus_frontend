import { describe, expect, it } from 'vitest';
import { effectiveSqmPerWorker, roomCapacityWarning } from './camp-capacity.js';
import { fieldKeyFromLabel, normalizeKey } from './keys.js';
import { isExitStatus } from './worker-status.js';
import { clashesWithSystemField, hasFieldValue, isSystemFieldKey } from '../fields.js';
import { canAccessCamp, hasPermission } from '../permissions.js';

describe('normalizeKey', () => {
  it('collapses whitespace and case', () => {
    expect(normalizeKey('  Room   2B ')).toBe('room 2b');
    expect(normalizeKey('BED 3')).toBe(normalizeKey('bed 3'));
  });

  it('builds custom field keys from labels', () => {
    expect(fieldKeyFromLabel(' Shoe Size (EU) ')).toBe('shoe_size_eu');
  });
});

describe('camp capacity', () => {
  it('defaults to 3.7 sqm in Dubai and 3.0 elsewhere', () => {
    expect(effectiveSqmPerWorker({ emirate: 'DUBAI', sqmPerWorker: null })).toBe(3.7);
    expect(effectiveSqmPerWorker({ emirate: 'SHARJAH', sqmPerWorker: null })).toBe(3.0);
    expect(effectiveSqmPerWorker({ emirate: 'SHARJAH', sqmPerWorker: 4.5 })).toBe(4.5);
  });

  it('warns only when active beds exceed area / sqm', () => {
    expect(roomCapacityWarning(30, 8, 3.7)).toBeNull(); // floor(8.1) = 8
    expect(roomCapacityWarning(30, 9, 3.7)).toEqual({ maxBeds: 8, activeBeds: 9 });
    expect(roomCapacityWarning(null, 50, 3.0)).toBeNull();
  });
});

describe('exit statuses', () => {
  it('recognises exit statuses only', () => {
    expect(isExitStatus('RESIGNED')).toBe(true);
    expect(isExitStatus('TRANSFERRED_OUT')).toBe(true);
    expect(isExitStatus('ACTIVE')).toBe(false);
  });
});

describe('fields', () => {
  it('knows system fields', () => {
    expect(isSystemFieldKey('employee_code')).toBe(true);
    expect(isSystemFieldKey('shoe_size')).toBe(false);
  });

  it('detects custom labels that clash with built-in labels or keys', () => {
    expect(clashesWithSystemField('Email  ID', 'email_id')).toBe(true);
    expect(clashesWithSystemField('Remarks', 'remarks')).toBe(true);
    expect(clashesWithSystemField('Shoe Size', 'shoe_size')).toBe(false);
  });

  it('treats blank values as no data', () => {
    expect(hasFieldValue(null)).toBe(false);
    expect(hasFieldValue('  ')).toBe(false);
    expect(hasFieldValue(0)).toBe(true);
    expect(hasFieldValue(false)).toBe(true);
  });
});

describe('permissions', () => {
  const supervisor = {
    isSystemAdmin: false,
    permissions: ['camps.view'],
    campScope: 'ASSIGNED' as const,
    campIds: ['c1'],
  };

  it('checks permission lists, admin has everything', () => {
    expect(hasPermission(supervisor, 'camps.view')).toBe(true);
    expect(hasPermission(supervisor, 'workers.viewIdentity')).toBe(false);
    expect(hasPermission({ ...supervisor, isSystemAdmin: true }, 'workers.viewIdentity')).toBe(true);
  });

  it('limits camp access by scope', () => {
    expect(canAccessCamp(supervisor, 'c1')).toBe(true);
    expect(canAccessCamp(supervisor, 'c2')).toBe(false);
    expect(canAccessCamp({ ...supervisor, campScope: 'ALL' }, 'c2')).toBe(true);
  });
});
