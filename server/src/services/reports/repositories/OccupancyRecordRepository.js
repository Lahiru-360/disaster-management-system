import mongoose from 'mongoose';
import { OccupancyRecord as OccupancyRecordModel } from '../../../models/OccupancyRecord.js';

// UC03's shelter occupancy records (§13.4.2), read for occupancy over time.
// Read-only.
export class OccupancyRecordRepository {
  #occupancyModel;

  constructor({ occupancyModel = OccupancyRecordModel } = {}) {
    this.#occupancyModel = occupancyModel;
  }

  /**
   * The records of these districts saved inside the range, oldest first.
   * @param {{ districtIds: string[], start: Date, end: Date }} params end excluded
   * @returns {Promise<Array<{ shelter: string, district: string, occupants: number, recordedAt: Date }>>}
   */
  async findInRange({ districtIds, start, end }) {
    const records = await this.#occupancyModel
      .find(
        { district: { $in: districtIds }, recordedAt: { $gte: start, $lt: end } },
        'shelter district occupants recordedAt',
      )
      .sort({ recordedAt: 1 })
      .lean();
    return records.map(OccupancyRecordRepository.#toRecord);
  }

  /**
   * Each shelter's latest record saved before `start`, for these districts:
   * where the shelter stood when the range began.
   * @param {{ districtIds: string[], start: Date }} params
   * @returns {Promise<Array<{ shelter: string, district: string, occupants: number, recordedAt: Date }>>}
   */
  async findLatestBefore({ districtIds, start }) {
    // An aggregate isn't cast by the schema, so the ids are made ObjectIds here.
    const latest = await this.#occupancyModel.aggregate([
      {
        $match: {
          district: { $in: districtIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
          recordedAt: { $lt: start },
        },
      },
      { $sort: { recordedAt: -1 } },
      { $group: { _id: '$shelter', record: { $first: '$$ROOT' } } },
    ]);
    return latest.map(({ record }) => OccupancyRecordRepository.#toRecord(record));
  }

  static #toRecord(record) {
    return {
      shelter: String(record.shelter),
      district: String(record.district),
      occupants: record.occupants,
      recordedAt: record.recordedAt,
    };
  }
}
