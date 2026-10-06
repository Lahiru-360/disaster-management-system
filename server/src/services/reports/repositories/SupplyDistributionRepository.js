import mongoose from 'mongoose';

// UC03's relief distribution records (§13.11.2), read for resource
// distribution. Read-only.
//
// FALLBACK (X-3): the SupplyDistribution model (DMS-143.2) is not on develop
// yet, so this reads its collection directly, using only the frozen §13.11.2
// fields. When it merges, query the model instead (Check #275).
export class SupplyDistributionRepository {
  static COLLECTION = 'supplydistributions';

  #connection;

  constructor({ connection = mongoose.connection } = {}) {
    this.#connection = connection;
  }

  /**
   * The distributions to these districts logged inside the range.
   * @param {{ districtIds: string[], start: Date, end: Date }} params end excluded
   * @returns {Promise<Array<{ district: string, supplyType: string, organisation: string, quantity: number, distributedAt: Date }>>}
   */
  async findInRange({ districtIds, start, end }) {
    const records = await this.#connection
      .collection(SupplyDistributionRepository.COLLECTION)
      .find(
        {
          district: { $in: districtIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
          distributedAt: { $gte: start, $lt: end },
        },
        {
          projection: {
            district: 1,
            supplyType: 1,
            organisation: 1,
            quantity: 1,
            distributedAt: 1,
          },
        },
      )
      .toArray();

    return records.map((record) => ({
      district: String(record.district),
      supplyType: record.supplyType,
      organisation: String(record.organisation),
      quantity: record.quantity,
      distributedAt: record.distributedAt,
    }));
  }
}
