// Where a hazard report was made, in decimal degrees (WGS 84). A value object:
// composed into HazardReport (UC02 class diagram) and never changed once made.
// The database stores it as a GeoJSON Point, whose order is [lng, lat], so the
// conversion lives here and nowhere else.
export class Coordinates {
  #latitude;
  #longitude;

  /**
   * @param {{ latitude: number, longitude: number }} point
   */
  constructor({ latitude, longitude } = {}) {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new RangeError(`Coordinates: latitude ${latitude} is not between -90 and 90`);
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new RangeError(`Coordinates: longitude ${longitude} is not between -180 and 180`);
    }
    this.#latitude = latitude;
    this.#longitude = longitude;
  }

  /**
   * @param {{ type: 'Point', coordinates: [number, number] }} point A GeoJSON Point.
   * @returns {Coordinates}
   */
  static fromGeoJSON({ coordinates: [longitude, latitude] }) {
    return new Coordinates({ latitude, longitude });
  }

  get latitude() {
    return this.#latitude;
  }

  get longitude() {
    return this.#longitude;
  }

  /** The GeoJSON Point to store: { type: 'Point', coordinates: [lng, lat] }. */
  toGeoJSON() {
    return { type: 'Point', coordinates: [this.#longitude, this.#latitude] };
  }

  /** The `{ latitude, longitude }` the API uses (contract §9.1). */
  toJSON() {
    return { latitude: this.#latitude, longitude: this.#longitude };
  }

  /** The `{ lat, lng }` point GeoDistance and AreaRegistry take. */
  toPoint() {
    return { lat: this.#latitude, lng: this.#longitude };
  }
}
