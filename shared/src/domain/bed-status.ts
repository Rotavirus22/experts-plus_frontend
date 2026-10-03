/**
 * Bed status is DERIVED, never stored.
 * Precedence: Invalidated > Held (occupant on leave) > Occupied > Vacant.
 */
export const BED_STATUSES = ['INVALIDATED', 'HELD', 'OCCUPIED', 'VACANT'] as const;
export type BedStatus = (typeof BED_STATUSES)[number];

export interface BedStatusInput {
  isActive: boolean;
  openAssignment: { occupantOnLeave: boolean } | null;
}

export function deriveBedStatus(bed: BedStatusInput): BedStatus {
  if (!bed.isActive) return 'INVALIDATED';
  if (bed.openAssignment) return bed.openAssignment.occupantOnLeave ? 'HELD' : 'OCCUPIED';
  return 'VACANT';
}

/** Only a vacant bed can receive a worker. Held beds stay reserved for the worker on leave. */
export function canAssignTo(status: BedStatus): boolean {
  return status === 'VACANT';
}

/** A bed may be invalidated only when nobody holds it. */
export function canInvalidateBed(status: BedStatus): boolean {
  return status === 'VACANT';
}

export const BED_STATUS_LABELS: Record<BedStatus, string> = {
  INVALIDATED: 'Invalidated',
  HELD: 'Held',
  OCCUPIED: 'Occupied',
  VACANT: 'Vacant',
};
