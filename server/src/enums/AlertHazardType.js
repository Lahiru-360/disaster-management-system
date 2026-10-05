// The kinds of hazard a warning can be issued for (UC01's HazardType). Named
// AlertHazardType because UC02's citizen reports have their own, different list.
export const AlertHazardType = Object.freeze({
  FLOOD: 'FLOOD',
  LANDSLIDE: 'LANDSLIDE',
  CYCLONE: 'CYCLONE',
  DROUGHT: 'DROUGHT',
});
