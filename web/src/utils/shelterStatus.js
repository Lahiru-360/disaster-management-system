// Shelter occupancy status as the server computes it (docs/api-contract.md
// §13.2, DMS-141): the exact ratio currentOccupancy / capacity, never rounded
// at the boundaries. The dialog uses this to preview the status while the
// officer types; the server stays the source of truth and its answer replaces
// the preview once saved.

export const SHELTER_STATUS_TONES = {
  AVAILABLE: 'success',
  FILLING_UP: 'warning',
  NEAR_CAPACITY: 'warning',
  FULL: 'danger',
};

export const SHELTER_STATUS_LABELS = {
  AVAILABLE: 'Available',
  FILLING_UP: 'Filling up',
  NEAR_CAPACITY: 'Near capacity',
  FULL: 'Full',
};

/**
 * The status for `occupants` people in a shelter of `capacity`. Compares
 * `occupants * 100` with `capacity * limit`, so 449 of 500 (89.8%) stays
 * FILLING_UP and 450 (90%) is NEAR_CAPACITY. A capacity of 0 with anyone in
 * it is FULL.
 * @param {number} occupants
 * @param {number} capacity
 * @returns {'AVAILABLE'|'FILLING_UP'|'NEAR_CAPACITY'|'FULL'}
 */
export function shelterStatusFor(occupants, capacity) {
  const scaled = occupants * 100;
  if (scaled < capacity * 75) return 'AVAILABLE';
  if (scaled < capacity * 90) return 'FILLING_UP';
  if (scaled < capacity * 100) return 'NEAR_CAPACITY';
  return 'FULL';
}

/**
 * The occupancy as a whole-number percentage for display, e.g. 0.92 -> 92.
 * Display only: the status must come from `shelterStatusFor`, not from this.
 * @param {number} occupants
 * @param {number} capacity
 * @returns {number}
 */
export function occupancyPercent(occupants, capacity) {
  return capacity > 0 ? Math.round((occupants / capacity) * 100) : 0;
}
