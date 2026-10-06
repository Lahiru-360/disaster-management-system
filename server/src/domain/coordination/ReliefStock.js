import { SupplyType } from '../../enums/SupplyType.js';

// What one Organisation holds of one supply type in one district (UC03).
// What was given out is a SupplyDistribution, kept apart from the holding.
//
// Built from a ReliefStock document; nothing here knows about the database.
export class ReliefStock {
  #stockId;
  #organisation;
  #district;
  #supplyType;
  #unit;
  #quantityAvailable;

  constructor({ stockId, organisation, district, supplyType, unit, quantityAvailable } = {}) {
    if (stockId === undefined || stockId === null) {
      throw new Error('ReliefStock needs a stockId');
    }
    if (!Object.values(SupplyType).includes(supplyType)) {
      throw new Error(`Unknown supply type: ${supplyType}`);
    }
    if (!Number.isInteger(quantityAvailable) || quantityAvailable < 0) {
      throw new Error('ReliefStock quantity must be a whole number, 0 or more');
    }
    this.#stockId = String(stockId);
    this.#organisation = organisation;
    this.#district = district;
    this.#supplyType = supplyType;
    this.#unit = unit;
    this.#quantityAvailable = quantityAvailable;
  }

  /**
   * Maps a ReliefStock document (hydrated, lean or toJSON form) onto the domain
   * class. organisation and district may be ids or populated documents.
   * @param {object} doc
   * @returns {ReliefStock}
   */
  static fromDocument(doc) {
    const fields = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return new ReliefStock({ ...fields, stockId: fields._id ?? fields.id });
  }

  /** The stock row's id, as a string. */
  get stockId() {
    return this.#stockId;
  }

  /** The owning organisation: its id, or a populated Organisation document. */
  get organisation() {
    return this.#organisation;
  }

  get district() {
    return this.#district;
  }

  get supplyType() {
    return this.#supplyType;
  }

  /** What a quantity is counted in, e.g. "bottles". */
  get unit() {
    return this.#unit;
  }

  get quantityAvailable() {
    return this.#quantityAvailable;
  }
}
