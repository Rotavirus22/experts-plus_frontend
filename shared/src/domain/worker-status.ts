export const WORKER_STATUSES = [
  'ACTIVE',
  'RESIGNED',
  'TERMINATED',
  'ABSCONDED',
  'VISA_CANCELLED',
  'TRANSFERRED_OUT',
] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export const EXIT_STATUSES = [
  'RESIGNED',
  'TERMINATED',
  'ABSCONDED',
  'VISA_CANCELLED',
  'TRANSFERRED_OUT',
] as const satisfies readonly WorkerStatus[];
export type ExitStatus = (typeof EXIT_STATUSES)[number];

export function isExitStatus(status: string): status is ExitStatus {
  return (EXIT_STATUSES as readonly string[]).includes(status);
}

export const WORKER_STATUS_LABELS: Record<WorkerStatus, string> = {
  ACTIVE: 'Active',
  RESIGNED: 'Resigned',
  TERMINATED: 'Terminated',
  ABSCONDED: 'Absconded',
  VISA_CANCELLED: 'Visa Cancelled',
  TRANSFERRED_OUT: 'Transferred Out',
};

export const BED_TYPES = ['SINGLE', 'BUNK_LOWER', 'BUNK_UPPER'] as const;
export type BedType = (typeof BED_TYPES)[number];

export const ASSIGNMENT_END_REASONS = ['MOVED', 'EXITED'] as const;
export type AssignmentEndReason = (typeof ASSIGNMENT_END_REASONS)[number];
