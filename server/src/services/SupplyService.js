import { InsufficientStockError } from '../domain/coordination/InsufficientStockError.js';
import { ReliefStock } from '../domain/coordination/ReliefStock.js';
import { ReliefStock as ReliefStockModel } from '../models/ReliefStock.js';
import { Shelter as ShelterModel } from '../models/Shelter.js';
import { SupplyDistribution as SupplyDistributionModel } from '../models/SupplyDistribution.js';
import { ApiError } from '../utils/ApiError.js';
import { systemClock } from '../utils/SystemClock.js';
import { activeIncident as defaultActiveIncident } from './ActiveIncident.js';
import { CoordinationPresenter } from './CoordinationPresenter.js';
import { districtScope as defaultDistrictScope } from './DistrictScope.js';

// UC03 main flow steps 12-13: the SupplyController's work in sequence diagram
// (c). What an organisation holds (ReliefStock) and what was given to a
// shelter (SupplyDistribution) are kept apart; logging a distribution moves
// quantity from the first to the second. Every collaborator comes through the
// constructor.
export class SupplyService {
  static #OBJECT_ID = /^[0-9a-fA-F]{24}$/;

  #stockModel;
  #distributionModel;
  #shelterModel;
  #districtScope;
  #activeIncident;
  #clock;

  constructor({
    stockModel = ReliefStockModel,
    distributionModel = SupplyDistributionModel,
    shelterModel = ShelterModel,
    districtScope = defaultDistrictScope,
    activeIncident = defaultActiveIncident,
    clock = systemClock,
  } = {}) {
    this.#stockModel = stockModel;
    this.#distributionModel = distributionModel;
    this.#shelterModel = shelterModel;
    this.#districtScope = districtScope;
    this.#activeIncident = activeIncident;
    this.#clock = clock;
  }

  /**
   * The stock rows for the Log Relief Supply dialog (contract §13.11.1): the
   * district the caller may see, optionally one organisation or supply type,
   * sorted by organisation name then supply type. Empty rows are included.
   * @param {object} user The signed-in User.
   * @param {{ districtId?: string, organisationId?: string, supplyType?: string }} [query]
   * @returns {Promise<object[]>} Relief stock objects (§13.2).
   */
  async listStock(user, { districtId, organisationId, supplyType } = {}) {
    const district = await this.#districtScope.readableDistrict(user, districtId);
    const filter = { district };
    if (organisationId) filter.organisation = organisationId;
    if (supplyType) filter.supplyType = supplyType;

    const docs = await this.#stockModel.find(filter).populate(CoordinationPresenter.STOCK_POPULATE);
    return docs
      .map((doc) => CoordinationPresenter.stock(doc))
      .sort(
        (a, b) =>
          a.organisation.name.localeCompare(b.organisation.name) ||
          a.supplyType.localeCompare(b.supplyType),
      );
  }

  /**
   * UC03 steps 12-13 (logDistribution in sequence diagram (c), contract
   * §13.11.2): takes the quantity out of the organisation's stock and records
   * it as given to the shelter. The stock is reduced only if enough is still
   * there at that moment, so two logs can never overdraw it between them; the
   * one that loses gets E5 with what is left.
   * @param {object} user The signed-in district officer.
   * @param {{ shelterId: string, stockId: string, quantity: number }} input
   * @returns {Promise<{ distribution: object, stock: object }>}
   * @throws {ApiError} 404 NOT_FOUND, 403 FORBIDDEN, 409 NO_ACTIVE_INCIDENT, or InsufficientStockError (400, E5).
   */
  async logDistribution(user, { shelterId, stockId, quantity }) {
    const stockDoc = await this.#findOrThrow(this.#stockModel, stockId, 'Relief stock not found.');
    const shelterDoc = await this.#findOrThrow(this.#shelterModel, shelterId, 'Shelter not found.');
    this.#districtScope.assertOwnDistrict(user, stockDoc.district);
    this.#districtScope.assertOwnDistrict(user, shelterDoc.district);
    await this.#activeIncident.require(stockDoc.district);

    // findById(stockId) -> [valid] withdraw(qty): the rule, on what was read.
    ReliefStock.fromDocument(stockDoc).withdraw(quantity);

    const updated = await this.#stockModel.findOneAndUpdate(
      { _id: stockDoc._id, quantityAvailable: { $gte: quantity } },
      { $inc: { quantityAvailable: -quantity } },
      { returnDocument: 'after' },
    );
    if (!updated) {
      // Another log took it first: answer with what is left now.
      const now = await this.#stockModel.findById(stockDoc._id);
      throw new InsufficientStockError(now.quantityAvailable, now.unit);
    }

    let distribution;
    try {
      distribution = await this.#distributionModel.create({
        shelter: shelterDoc._id,
        stock: stockDoc._id,
        organisation: stockDoc.organisation,
        supplyType: stockDoc.supplyType,
        district: stockDoc.district,
        quantity,
        distributedAt: this.#clock.now(),
        loggedBy: user._id,
      });
    } catch (error) {
      // Nothing was recorded, so the quantity goes back into the stock.
      await this.#stockModel.updateOne(
        { _id: stockDoc._id },
        { $inc: { quantityAvailable: quantity } },
      );
      throw error;
    }

    await distribution.populate(CoordinationPresenter.DISTRIBUTION_POPULATE);
    await updated.populate(CoordinationPresenter.STOCK_POPULATE);
    return {
      distribution: CoordinationPresenter.distribution(distribution),
      stock: CoordinationPresenter.stock(updated),
    };
  }

  async #findOrThrow(model, id, message) {
    const doc = SupplyService.#OBJECT_ID.test(id) ? await model.findById(id) : null;
    if (!doc) throw new ApiError(404, 'NOT_FOUND', message);
    return doc;
  }
}

export const supplyService = new SupplyService();
