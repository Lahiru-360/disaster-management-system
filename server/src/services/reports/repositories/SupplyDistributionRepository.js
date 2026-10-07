import { SupplyDistribution as SupplyDistributionModel } from '../../../models/SupplyDistribution.js';

// UC03's relief distribution records (§13.11.2), read for resource
// distribution. Read-only.
export class SupplyDistributionRepository {
  #distributionModel;

  constructor({ distributionModel = SupplyDistributionModel } = {}) {
    this.#distributionModel = distributionModel;
  }

  /**
   * The distributions to these districts logged inside the range.
   * @param {{ districtIds: string[], start: Date, end: Date }} params end excluded
   * @returns {Promise<Array<{ district: string, supplyType: string, organisation: string, quantity: number, distributedAt: Date }>>}
   */
  async findInRange({ districtIds, start, end }) {
    const records = await this.#distributionModel
      .find(
        { district: { $in: districtIds }, distributedAt: { $gte: start, $lt: end } },
        'district supplyType organisation quantity distributedAt',
      )
      .lean();

    return records.map((record) => ({
      district: String(record.district),
      supplyType: record.supplyType,
      organisation: String(record.organisation),
      quantity: record.quantity,
      distributedAt: record.distributedAt,
    }));
  }
}
