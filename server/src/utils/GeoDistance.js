// Great-circle distances between { lat, lng } points in decimal degrees. The
// one place distance is worked out, so UC02's 500 m duplicate check and UC03's
// nearest team / shelter all agree.
export class GeoDistance {
  static #EARTH_RADIUS_METRES = 6371000;

  /**
   * The haversine distance between two points, in metres.
   * @param {{ lat: number, lng: number }} a
   * @param {{ lat: number, lng: number }} b
   * @returns {number}
   */
  static haversineMetres(a, b) {
    GeoDistance.#assertPoint(a);
    GeoDistance.#assertPoint(b);

    const toRadians = (degrees) => (degrees * Math.PI) / 180;
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;

    return 2 * GeoDistance.#EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /**
   * How far a point lies outside a bounding box, in metres: 0 when it is inside
   * or on an edge, otherwise the distance to the nearest point of the box.
   * @param {{ lat: number, lng: number }} point
   * @param {{ minLat: number, maxLat: number, minLng: number, maxLng: number }} bounds
   * @returns {number}
   */
  static metresOutsideBox(point, bounds) {
    GeoDistance.#assertPoint(point);

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const nearest = {
      lat: clamp(point.lat, bounds.minLat, bounds.maxLat),
      lng: clamp(point.lng, bounds.minLng, bounds.maxLng),
    };

    return GeoDistance.haversineMetres(point, nearest);
  }

  // A missing or non-numeric coordinate would otherwise come out as NaN, which
  // quietly breaks every comparison and sort that uses the distance.
  static #assertPoint(point) {
    if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lng)) {
      throw new TypeError(`Not a { lat, lng } point: ${JSON.stringify(point)}`);
    }
  }
}
