import { ShelterStatus } from '../../enums/ShelterStatus.js';

// An emergency shelter a District hosts (UC03). Its status comes from how
// full it is: the thresholds below are the improved design's, compared on the
// exact ratio, so 89.9% is never shown as Near capacity.
//
// Built from a Shelter document; nothing here knows about the database.
export class Shelter {
  // Percent bounds, each the first rate of the next status.
  static #FILLING_UP_FROM = 75;
  static #NEAR_CAPACITY_FROM = 90;
  static #FULL_FROM = 100;

  #shelterId;
  #name;
  #district;
  #location;
  #capacity;
  #currentOccupancy;

  constructor({ shelterId, name, district, location, capacity, currentOccupancy = 0 } = {}) {
    if (shelterId === undefined || shelterId === null) {
      throw new Error('Shelter needs a shelterId');
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error('Shelter capacity must be a whole number, 1 or more');
    }
    if (!Number.isInteger(currentOccupancy) || currentOccupancy < 0) {
      throw new Error('Shelter occupancy must be a whole number, 0 or more');
    }
    this.#shelterId = String(shelterId);
    this.#name = name;
    this.#district = district;
    this.#location = location ? Object.freeze({ ...location }) : undefined;
    this.#capacity = capacity;
    this.#currentOccupancy = currentOccupancy;
  }

  /**
   * Maps a Shelter document (hydrated, lean or toJSON form) onto the domain class.
   * @param {object} doc
   * @returns {Shelter}
   */
  static fromDocument(doc) {
    const fields = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return new Shelter({ ...fields, shelterId: fields._id ?? fields.id });
  }

  /** The shelter's id, as a string. */
  get shelterId() {
    return this.#shelterId;
  }

  get name() {
    return this.#name;
  }

  /** The hosting district: its id, or a populated District document. */
  get district() {
    return this.#district;
  }

  /** { lat, lng, label }. */
  get location() {
    return this.#location;
  }

  get capacity() {
    return this.#capacity;
  }

  get currentOccupancy() {
    return this.#currentOccupancy;
  }

  /**
   * Occupants per place, unrounded: 0.92 for 460 of 500, above 1 when over
   * capacity.
   * @returns {number}
   */
  occupancyRate() {
    return this.#currentOccupancy / this.#capacity;
  }

  /**
   * AVAILABLE below 75%, FILLING_UP from 75%, NEAR_CAPACITY from 90%, FULL
   * from 100%. Compared in whole numbers (occupancy x 100 against capacity x
   * the bound), so a boundary is never missed by floating-point rounding.
   * @returns {string} a ShelterStatus
   */
  status() {
    const scaledOccupancy = this.#currentOccupancy * 100;
    if (scaledOccupancy < this.#capacity * Shelter.#FILLING_UP_FROM) {
      return ShelterStatus.AVAILABLE;
    }
    if (scaledOccupancy < this.#capacity * Shelter.#NEAR_CAPACITY_FROM) {
      return ShelterStatus.FILLING_UP;
    }
    if (scaledOccupancy < this.#capacity * Shelter.#FULL_FROM) {
      return ShelterStatus.NEAR_CAPACITY;
    }
    return ShelterStatus.FULL;
  }
}
