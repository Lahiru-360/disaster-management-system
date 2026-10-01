// Abstract base for anything a hazard warning can be aimed at: a District, or
// a RiverBasin that spans several districts. Each subclass decides for itself
// which citizens it covers, so a warning's reach is worked out the same way
// whatever kind of area it targets.
//
// Built from the District / RiverBasin documents by AreaRegistry; nothing in
// this folder knows about the database.
export class TargetArea {
  #areaId;
  #name;

  constructor({ areaId, name } = {}) {
    if (new.target === TargetArea) {
      throw new Error('TargetArea is abstract - construct a District or RiverBasin instead');
    }
    if (areaId === undefined || areaId === null) {
      throw new Error(`${new.target.name} needs an areaId`);
    }
    this.#areaId = String(areaId);
    this.#name = name;
  }

  /** The area's id, as a string - the `id` the Areas endpoints return. */
  get areaId() {
    return this.#areaId;
  }

  get name() {
    return this.#name;
  }

  /**
   * Whether the citizen lives in this area, judged by their home district.
   * @param {{ homeDistrict?: TargetArea|string|object }} _citizen
   * @returns {boolean}
   */
  contains(_citizen) {
    throw new Error(`${this.constructor.name} must override contains()`);
  }
}
