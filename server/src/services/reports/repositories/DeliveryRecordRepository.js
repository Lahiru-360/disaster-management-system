import mongoose from 'mongoose';

// UC01's delivery records (§12.9), read for citizens reached. Read-only.
//
// FALLBACK (X-2): the Notification model (DMS-121.2) is not on develop yet, so
// this reads its collection directly, using only the frozen §12.9 fields. When
// it merges, query the model instead and use its DeliveryStatus enum (Check #275).
export class DeliveryRecordRepository {
  static COLLECTION = 'notifications';

  // Every status but QUEUED: the record has left the queue (§12.7's "sent").
  static #LEFT_QUEUE = ['SENT', 'DELIVERED', 'FAILED'];

  #connection;

  constructor({ connection = mongoose.connection } = {}) {
    this.#connection = connection;
  }

  /**
   * The delivery records of these alerts that left the queue inside the range.
   * @param {{ alertIds: string[], start: Date, end: Date }} params end excluded
   * @returns {Promise<Array<{ alert: string, citizen: string, channel: string, status: string, sentAt: Date }>>}
   */
  async findSent({ alertIds, start, end }) {
    if (alertIds.length === 0) {
      return [];
    }
    const records = await this.#connection
      .collection(DeliveryRecordRepository.COLLECTION)
      .find(
        {
          alert: { $in: alertIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
          status: { $in: DeliveryRecordRepository.#LEFT_QUEUE },
          sentAt: { $gte: start, $lt: end },
        },
        { projection: { alert: 1, citizen: 1, channel: 1, status: 1, sentAt: 1 } },
      )
      .toArray();

    return records.map((record) => ({
      alert: String(record.alert),
      citizen: String(record.citizen),
      channel: record.channel,
      status: record.status,
      sentAt: record.sentAt,
    }));
  }
}
