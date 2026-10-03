/**
 * Room numbers are strings ("101", "2B", "G-12") and must sort naturally:
 * "2" before "10", "1A" before "1B". Always sort in JS with this collator, never in the database.
 */
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function compareRoomNumbers(a: string, b: string): number {
  const result = collator.compare(a.trim(), b.trim());
  if (result !== 0) return result;
  // Collator treats "g-2" and "G-2" as equal; fall back to a plain comparison so order is deterministic.
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortRooms<T extends { number: string }>(rooms: readonly T[]): T[] {
  return [...rooms].sort((a, b) => compareRoomNumbers(a.number, b.number));
}

export function compareBeds(
  a: { position: number; label: string },
  b: { position: number; label: string },
): number {
  if (a.position !== b.position) return a.position - b.position;
  return compareRoomNumbers(a.label, b.label);
}

export function sortBeds<T extends { position: number; label: string }>(beds: readonly T[]): T[] {
  return [...beds].sort(compareBeds);
}
