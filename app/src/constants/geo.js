// "Within Sri Lanka" for a hazard report's location - the same box, edges
// included, as the server's src/constants/geo.js (UC02 E1). Keep the two in
// step: the server is the one that decides, this only lets the app say so
// before sending.
export const SRI_LANKA_BOUNDS = Object.freeze({
  minLat: 5.85,
  maxLat: 9.9,
  minLng: 79.5,
  maxLng: 81.95,
});

export function isInsideSriLanka({ latitude, longitude }) {
  return (
    latitude >= SRI_LANKA_BOUNDS.minLat &&
    latitude <= SRI_LANKA_BOUNDS.maxLat &&
    longitude >= SRI_LANKA_BOUNDS.minLng &&
    longitude <= SRI_LANKA_BOUNDS.maxLng
  );
}
