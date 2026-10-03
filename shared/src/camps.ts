/** Camp / room / bed request schemas and response shapes (shared by backend and frontend). */
import { z } from 'zod';
import type { BedStatus } from './domain/bed-status.js';
import { EMIRATES, type Emirate } from './domain/camp-capacity.js';
import { BED_TYPES, type BedType } from './domain/worker-status.js';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id');
const optionalNumber = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.coerce.number().min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`).nullable(),
  );

export const campInputSchema = z.object({
  name: z.string().trim().min(1, 'Camp name is required').max(80),
  emirate: z.enum(EMIRATES),
  address: z.string().trim().max(300).optional().default(''),
  /** Empty = default for the emirate (3.7 Dubai, 3.0 elsewhere). */
  sqmPerWorker: optionalNumber(1, 50, 'Square metres per worker'),
});
export type CampInput = z.input<typeof campInputSchema>;

export const roomInputSchema = z.object({
  number: z.string().trim().min(1, 'Room number is required').max(20),
  areaSqm: optionalNumber(1, 10_000, 'Area'),
  layoutColumns: z.coerce.number().int().min(1).max(12).default(4),
  notes: z.string().trim().max(300).optional().default(''),
});
export type RoomInput = z.input<typeof roomInputSchema>;

/** Add several beds at once. Labels continue from the room's highest "<prefix><number>". */
export const BED_LAYOUTS = ['SINGLE', 'BUNK_PAIRS', 'UNSPECIFIED'] as const;
export const bedsAddSchema = z.object({
  count: z.coerce.number().int().min(1, 'At least 1 bed').max(40, 'At most 40 beds at a time'),
  // Not trimmed at the end: "Bed " gives "Bed 1", "B" gives "B1".
  prefix: z.string().max(10).transform((v) => v.trimStart()).default('B'),
  layout: z.enum(BED_LAYOUTS).default('SINGLE'),
});
export type BedsAddInput = z.input<typeof bedsAddSchema>;

export const bedUpdateSchema = z.object({
  label: z.string().trim().min(1, 'Bed label is required').max(20),
  type: z.enum(BED_TYPES).nullable(),
});
export type BedUpdateInput = z.input<typeof bedUpdateSchema>;

export const bedOrderSchema = z.object({
  bedIds: z.array(objectId).min(1).max(200),
});

// ───────── Responses ─────────

export interface InvalidationDto {
  at: string;
  reason: string | null;
  byName: string | null;
}

export interface OccupancyDto {
  beds: number;
  occupied: number;
  held: number;
  vacant: number;
}

export interface CampSummaryDto {
  id: string;
  name: string;
  emirate: Emirate;
  address: string | null;
  sqmPerWorker: number | null;
  effectiveSqmPerWorker: number;
  isActive: boolean;
  invalidation: InvalidationDto | null;
  activeRooms: number;
  occupancy: OccupancyDto;
}

export interface BedOccupantDto {
  workerId: string;
  employeeCode: string;
  fullName: string;
  since: string;
  onLeave: boolean;
}

export interface BedDto {
  id: string;
  label: string;
  position: number;
  type: BedType | null;
  isActive: boolean;
  invalidation: InvalidationDto | null;
  status: BedStatus;
  occupant: BedOccupantDto | null;
}

export interface RoomDto {
  id: string;
  number: string;
  areaSqm: number | null;
  layoutColumns: number;
  notes: string | null;
  isActive: boolean;
  invalidation: InvalidationDto | null;
  beds: BedDto[];
  occupancy: OccupancyDto;
  capacityWarning: { maxBeds: number; activeBeds: number } | null;
}

export interface CampDetailDto extends CampSummaryDto {
  rooms: RoomDto[];
}
