/** Dashboard summary returned by GET /dashboard. */
import type { CampSummaryDto, OccupancyDto } from './camps.js';
import type { WorkerStatus } from './domain/worker-status.js';

export interface DashboardDto {
  today: string;
  workers: {
    active: number;
    housed: number;
    onLeave: number;
    withoutBed: number;
    joinedThisWeek: number;
    exitedThisMonth: number;
    exitedThisMonthByStatus: Partial<Record<WorkerStatus, number>>;
  };
  beds: OccupancyDto & { rooms: number; camps: number };
  camps: CampSummaryDto[];
  overCapacity: { total: number; rooms: { roomId: string; campId: string; campName: string; roomNumber: string; areaSqm: number; activeBeds: number; maxBeds: number }[] };
  onLeave: { total: number; rows: { workerId: string; employeeCode: string; fullName: string; since: string; bed: string | null }[] };
  recentExits: { total: number; rows: { workerId: string; fullName: string; status: WorkerStatus; exitDate: string; freedBed: string | null }[] };
  /** Only for users with audit.view. */
  activity: { id: string; at: string; actorName: string | null; kind: 'move' | 'exit' | 'leave' | 'invalidate' | 'create' | 'other'; text: string }[] | null;
}
