import mongoose from 'mongoose';

// UC03's shelter occupancy records (§13.4.2), read for occupancy over time.
// Read-only.
//
// FALLBACK (X-3): the OccupancyRecord model (DMS-141.2) is not on develop yet,
// so this reads its collection directly, using only the frozen §13.4.2 fields.
// When it merges, query the model instead (Check #275).
export class OccupancyRecordRepository {
  static COLLECTION = 'occupancyrecords';

  static #FIELDS = { shelter: 1, district: 1, occupants: 1, recordedAt: 1 };

  #connection;

  constructor({ connection = mongoose.connection } = {}) {
    this.#connection = connection;
  }

  /**
   * The records of these districts saved inside the range, oldest first.
   * @param {{ districtIds: string[], start: Date, end: Date }} params end excluded
   * @returns {Promise<Array<{ shelter: string, district: string, occupants: number, recordedAt: Date }>>}
   */
  async findInRange({ districtIds, start, end }) {
    const records = await this.#collection()
      .find(
        {
          district: { $in: OccupancyRecordRepository.#ids(districtIds) },
          recordedAt: { $gte: start, $lt: end },
        },
        { projection: OccupancyRecordRepository.#FIELDS },
      )
      .sort({ recordedAt: 1 })
      .toArray();
    return records.map(OccupancyRecordRepository.#toRecord);
  }

  /**
   * Each shelter's latest record saved before `start`, for these districts:
   * where the shelter stood when the range began.
   * @param {{ districtIds: string[], start: Date }} params
   * @returns {Promise<Array<{ shelter: string, district: string, occupants: number, recordedAt: Date }>>}
   */
  async findLatestBefore({ districtIds, start }) {
    const latest = await this.#collection()
      .aggregate([
        {
          $match: {
            district: { $in: OccupancyRecordRepository.#ids(districtIds) },
            recordedAt: { $lt: start },
          },
        },
        { $sort: { recordedAt: -1 } },
        { $group: { _id: '$shelter', record: { $first: '$$ROOT' } } },
      ])
      .toArray();
    return latest.map(({ record }) => OccupancyRecordRepository.#toRecord(record));
  }

  #collection() {
    return this.#connection.collection(OccupancyRecordRepository.COLLECTION);
  }

  static #ids(ids) {
    return ids.map((id) => new mongoose.Types.ObjectId(String(id)));
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
