/** Bed assignment requests and bed history responses. */
import { z } from 'zod';
import { isIsoDate } from './dates.js';
import type { BedStatus } from './domain/bed-status.js';
import type { BedType } from './domain/worker-status.js';
import type { BedOccupantDto } from './camps.js';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id');
const isoDate = z.string().refine(isIsoDate, 'Use a valid date (YYYY-MM-DD)');

export const assignInputSchema = z.object({
  workerId: objectId,
  bedId: objectId,
  startDate: isoDate,
});
export type AssignInput = z.infer<typeof assignInputSchema>;

export const moveInputSchema = z.object({
  workerId: objectId,
  toBedId: objectId,
  moveDate: isoDate,
});
export type MoveInput = z.infer<typeof moveInputSchema>;

export const candidateQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
});

/** A worker that can be put into a bed: without a bed (assign) or housed in a camp you manage (move). */
export interface BedCandidateDto {
  id: string;
  employeeCode: string;
  fullName: string;
  designation: string | null;
  nationality: string | null;
  onLeave: boolean;
  housing: { campName: string; roomNumber: string; bedLabel: string; since: string } | null;
}

export interface BedStayHistoryDto {
  id: string;
  workerId: string;
  employeeCode: string;
  fullName: string;
  startDate: string;
  endDate: string | null;
  endReason: 'MOVED' | 'EXITED' | null;
  createdByName: string | null;
  endedByName: string | null;
  invalidated: boolean;
}

export interface BedHistoryDto {
  bed: {
    id: string;
    label: string;
    type: BedType | null;
    isActive: boolean;
    status: BedStatus;
    invalidationReason: string | null;
  };
  room: { id: string; number: string; isActive: boolean };
  camp: { id: string; name: string; isActive: boolean };
  occupant: BedOccupantDto | null;
  /** Newest first. Includes the current stay. */
  stays: BedStayHistoryDto[];
}
