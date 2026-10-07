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
    Shelter.#assertOccupancy(currentOccupancy);
    this.#shelterId = String(shelterId);
    this.#name = name;
    this.#district = district;
    this.#location = location ? Object.freeze({ ...location }) : undefined;
    this.#capacity = capacity;
    this.#currentOccupancy = currentOccupancy;
  }

  // E1: an occupancy is a whole number of people, never negative.
  static #assertOccupancy(occupants) {
    if (!Number.isInteger(occupants) || occupants < 0) {
      throw new Error('Shelter occupancy must be a whole number, 0 or more');
    }
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
   * UC03 steps 3-4: records how many people are in the shelter now. Any whole
   * number from 0 is allowed, above capacity too - nobody is turned away, the
   * shelter is just FULL. Anything else (E1) is refused and changes nothing.
   * @param {number} occupants
   * @throws {Error} When occupants isn't a whole number, 0 or more.
   */
  updateOccupancy(occupants) {
    Shelter.#assertOccupancy(occupants);
    this.#currentOccupancy = occupants;
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

  /**
   * Whether new arrivals can still be sent here (UC03 A2): the shelter is
   * AVAILABLE or FILLING_UP, i.e. below 90%. A NEAR_CAPACITY or FULL shelter
   * has none, which is also what makes an alternate worth suggesting.
   * @returns {boolean}
   */
  hasSpareCapacity() {
    const status = this.status();
    return status === ShelterStatus.AVAILABLE || status === ShelterStatus.FILLING_UP;
  }
}
