/**
 * Normalised key used for "unique among active" checks (camp name, room number, bed label, role name).
 * "Room 2B", " room  2b " and "ROOM 2B" all collide.
 */
export function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Slug used as the storage key for custom fields, e.g. "Shoe Size" -> "shoe_size". */
export function fieldKeyFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
