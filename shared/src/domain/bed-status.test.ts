import { describe, expect, it } from 'vitest';
import { canAssignTo, canInvalidateBed, deriveBedStatus } from './bed-status.js';

describe('deriveBedStatus', () => {
  it('is VACANT with no open assignment', () => {
    expect(deriveBedStatus({ isActive: true, openAssignment: null })).toBe('VACANT');
  });

  it('is OCCUPIED when the occupant is present', () => {
    expect(deriveBedStatus({ isActive: true, openAssignment: { occupantOnLeave: false } })).toBe('OCCUPIED');
  });

  it('is HELD when the occupant is on leave (leave never frees a bed)', () => {
    expect(deriveBedStatus({ isActive: true, openAssignment: { occupantOnLeave: true } })).toBe('HELD');
  });

  it('INVALIDATED beats everything', () => {
    expect(deriveBedStatus({ isActive: false, openAssignment: null })).toBe('INVALIDATED');
    expect(deriveBedStatus({ isActive: false, openAssignment: { occupantOnLeave: false } })).toBe('INVALIDATED');
    expect(deriveBedStatus({ isActive: false, openAssignment: { occupantOnLeave: true } })).toBe('INVALIDATED');
  });
});

describe('canAssignTo', () => {
  it('allows only vacant beds', () => {
    expect(canAssignTo('VACANT')).toBe(true);
    expect(canAssignTo('OCCUPIED')).toBe(false);
    expect(canAssignTo('HELD')).toBe(false);
    expect(canAssignTo('INVALIDATED')).toBe(false);
  });
});

describe('canInvalidateBed', () => {
  it('allows only vacant beds', () => {
    expect(canInvalidateBed('VACANT')).toBe(true);
    expect(canInvalidateBed('OCCUPIED')).toBe(false);
    expect(canInvalidateBed('HELD')).toBe(false);
    expect(canInvalidateBed('INVALIDATED')).toBe(false);
  });
});
