// How full a shelter is, from its occupancy rate (UC03 step 5). The thresholds
// live with the Shelter domain class; this only names the values.
export const ShelterStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  FILLING_UP: 'FILLING_UP',
  NEAR_CAPACITY: 'NEAR_CAPACITY',
  FULL: 'FULL',
});
