export const EMIRATES = [
  'ABU_DHABI',
  'DUBAI',
  'SHARJAH',
  'AJMAN',
  'UMM_AL_QUWAIN',
  'RAS_AL_KHAIMAH',
  'FUJAIRAH',
] as const;
export type Emirate = (typeof EMIRATES)[number];

export const EMIRATE_LABELS: Record<Emirate, string> = {
  ABU_DHABI: 'Abu Dhabi',
  DUBAI: 'Dubai',
  SHARJAH: 'Sharjah',
  AJMAN: 'Ajman',
  UMM_AL_QUWAIN: 'Umm Al Quwain',
  RAS_AL_KHAIMAH: 'Ras Al Khaimah',
  FUJAIRAH: 'Fujairah',
};

export function defaultSqmPerWorker(emirate: Emirate): number {
  return emirate === 'DUBAI' ? 3.7 : 3.0;
}

export function effectiveSqmPerWorker(camp: { emirate: Emirate; sqmPerWorker: number | null }): number {
  return camp.sqmPerWorker ?? defaultSqmPerWorker(camp.emirate);
}

export interface CapacityWarning {
  maxBeds: number;
  activeBeds: number;
}

/** Warning only, never a block: returns details when active beds exceed area / sqm-per-worker. */
export function roomCapacityWarning(
  areaSqm: number | null,
  activeBeds: number,
  sqmPerWorker: number,
): CapacityWarning | null {
  if (areaSqm === null || areaSqm <= 0 || sqmPerWorker <= 0) return null;
  const maxBeds = Math.floor(areaSqm / sqmPerWorker);
  return activeBeds > maxBeds ? { maxBeds, activeBeds } : null;
}
