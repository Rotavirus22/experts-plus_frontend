import type { IsoDate } from '../dates.js';

/**
 * Leave is a simple toggle: "On leave" opens a record, "Returned" closes it.
 * A worker with an open leave keeps their bed (it shows as Held).
 */
export interface LeaveRecordLike {
  startDate: IsoDate;
  returnDate: IsoDate | null;
}

export type WorkerLeaveState = { kind: 'PRESENT' } | { kind: 'ON_LEAVE'; since: IsoDate };

export function isLeaveOpen(leave: LeaveRecordLike): boolean {
  return leave.returnDate === null;
}

export function workerLeaveState(openLeave: LeaveRecordLike | null | undefined): WorkerLeaveState {
  if (!openLeave || !isLeaveOpen(openLeave)) return { kind: 'PRESENT' };
  return { kind: 'ON_LEAVE', since: openLeave.startDate };
}
