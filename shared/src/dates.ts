/**
 * Calendar dates are plain "YYYY-MM-DD" strings in the Asia/Dubai timezone.
 * MongoDB has no DATE type, and ISO date strings sort and compare correctly as strings.
 */
export type IsoDate = string;

export const APP_TIME_ZONE = 'Asia/Dubai';

const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const dubaiFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's calendar date in Asia/Dubai. Never use toISOString().slice(0, 10): that is UTC. */
export function todayDubai(now: Date = new Date()): IsoDate {
  return dubaiFormatter.format(now);
}

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function compareIsoDate(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
