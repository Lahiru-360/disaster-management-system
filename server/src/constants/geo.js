// "Within Sri Lanka" for a hazard report's location (UC02 step 6 / E1): a
// bounding box around the island, edges included. An approximation of the
// coastline, recorded in the deviation log - it takes in a strip of sea, and
// nothing more precise is needed to refuse a point that is plainly elsewhere
// (such as the storyboard's Jakarta coordinates). Defined once here; the app
// keeps the same numbers in its own validation.
export const SRI_LANKA_BOUNDS = Object.freeze({
  minLat: 5.85,
  maxLat: 9.9,
  minLng: 79.5,
  maxLng: 81.95,
});

/**
 * Whether a point lies inside SRI_LANKA_BOUNDS, edges included.
 * @param {{ latitude: number, longitude: number }} point
 * @returns {boolean}
 */
export const isInsideSriLanka = ({ latitude, longitude }) =>
  latitude >= SRI_LANKA_BOUNDS.minLat &&
  latitude <= SRI_LANKA_BOUNDS.maxLat &&
  longitude >= SRI_LANKA_BOUNDS.minLng &&
  longitude <= SRI_LANKA_BOUNDS.maxLng;
