import { describe, expect, it } from 'vitest';
import { isLeaveOpen, workerLeaveState } from './leave-status.js';

describe('workerLeaveState', () => {
  it('is PRESENT with no leave', () => {
    expect(workerLeaveState(null)).toEqual({ kind: 'PRESENT' });
    expect(workerLeaveState(undefined)).toEqual({ kind: 'PRESENT' });
  });

  it('is ON_LEAVE with an open leave, carrying the start date', () => {
    expect(workerLeaveState({ startDate: '2026-09-20', returnDate: null })).toEqual({
      kind: 'ON_LEAVE',
      since: '2026-09-20',
    });
  });

  it('is PRESENT once returned', () => {
    expect(workerLeaveState({ startDate: '2026-09-20', returnDate: '2026-10-01' })).toEqual({ kind: 'PRESENT' });
  });

  it('isLeaveOpen reflects the return date', () => {
    expect(isLeaveOpen({ startDate: '2026-09-20', returnDate: null })).toBe(true);
    expect(isLeaveOpen({ startDate: '2026-09-20', returnDate: '2026-09-20' })).toBe(false);
  });
});
