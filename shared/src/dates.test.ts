import { describe, expect, it } from 'vitest';
import { compareIsoDate, isIsoDate, todayDubai } from './dates.js';

describe('todayDubai', () => {
  it('uses the Asia/Dubai calendar date (UTC+4), not UTC', () => {
    // 20:30 UTC is 00:30 the next day in Dubai.
    expect(todayDubai(new Date('2026-10-02T20:30:00Z'))).toBe('2026-10-03');
    expect(todayDubai(new Date('2026-10-02T19:59:59Z'))).toBe('2026-10-02');
  });

  it('crosses year boundaries', () => {
    expect(todayDubai(new Date('2026-12-31T21:00:00Z'))).toBe('2027-01-01');
  });
});

describe('isIsoDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isIsoDate('2026-10-02')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-1-01')).toBe(false);
    expect(isIsoDate('02/10/2026')).toBe(false);
  });
});

describe('compareIsoDate', () => {
  it('orders dates', () => {
    expect(compareIsoDate('2026-09-30', '2026-10-01')).toBeLessThan(0);
    expect(compareIsoDate('2026-10-01', '2026-10-01')).toBe(0);
    expect(compareIsoDate('2027-01-01', '2026-12-31')).toBeGreaterThan(0);
  });
});
