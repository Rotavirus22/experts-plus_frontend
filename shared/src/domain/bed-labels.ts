import type { BedType } from './worker-status.js';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Labels for `count` new beds continuing after the highest "<prefix><number>" already in the room
 * (active or invalidated, so old labels are never reused by accident). "B1".."B6" + 3 => "B7","B8","B9".
 */
export function nextBedLabels(existing: readonly string[], prefix: string, count: number): string[] {
  const re = new RegExp(`^${escapeRegExp(prefix.trim())}\\s*(\\d+)$`, 'i');
  const max = existing.reduce((m, label) => {
    const match = re.exec(label.trim());
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return Array.from({ length: count }, (_, i) => `${prefix.trimStart()}${max + i + 1}`);
}

/** Bed types for a bulk add. Bunk pairs alternate lower/upper; an odd last bed is a single. */
export function bedTypesFor(layout: 'SINGLE' | 'BUNK_PAIRS' | 'UNSPECIFIED', count: number): (BedType | null)[] {
  return Array.from({ length: count }, (_, i) => {
    if (layout === 'UNSPECIFIED') return null;
    if (layout === 'SINGLE') return 'SINGLE';
    if (i === count - 1 && count % 2 === 1) return 'SINGLE';
    return i % 2 === 0 ? 'BUNK_LOWER' : 'BUNK_UPPER';
  });
}

/** Columns for drawing a room's beds: a near-square grid, at most 6 wide (2 beds: 2, 6: 3, 12: 4, 30: 6). */
export function bedGridColumns(beds: number): number {
  if (beds <= 2) return Math.max(1, beds);
  return Math.min(6, Math.ceil(Math.sqrt(beds * 1.4)));
}
