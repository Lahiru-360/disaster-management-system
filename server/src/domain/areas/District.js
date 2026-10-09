import { TargetArea } from './TargetArea.js';

// One of the 25 districts of Sri Lanka, and the unit every citizen's home is
// recorded against. province, centroid and bounds are optional so a District
// can also be built from just { id, name }, e.g. a basin's populated districts.
export class District extends TargetArea {
  #province;
  #centroid;
  #bounds;

  constructor({ province, centroid, bounds, ...area } = {}) {
    super(area);
    this.#province = province;
    this.#centroid = centroid ? Object.freeze({ ...centroid }) : undefined;
    this.#bounds = bounds ? Object.freeze({ ...bounds }) : undefined;
  }

  get province() {
    return this.#province;
  }

  /** The reference point for distances: { lat, lng }. */
  get centroid() {
    return this.#centroid;
  }

  /** The bounding box: { minLat, maxLat, minLng, maxLng }. */
  get bounds() {
    return this.#bounds;
  }

  /**
   * True when the citizen's home district is this district. homeDistrict may
   * be a District or just its id (a string or an ObjectId); a citizen with no
   * home district on file is in no district.
   * @param {{ homeDistrict?: District|string|object }} citizen
   * @returns {boolean}
   */
  contains(citizen) {
    const home = citizen?.homeDistrict;
    if (home === undefined || home === null) {
      return false;
    }
    const homeId = home instanceof TargetArea ? home.areaId : String(home);
    return homeId === this.areaId;
  }
}
