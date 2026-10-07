const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

// Straight-line (haversine) distance between two { lat, lng } points in km,
// the same measure the server uses to order available teams (§13.6).
export function haversineKm(from, to) {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// "2.5 km", to one decimal place.
export function formatKm(km) {
  return `${(Math.round(km * 10) / 10).toFixed(1)} km`;
}
