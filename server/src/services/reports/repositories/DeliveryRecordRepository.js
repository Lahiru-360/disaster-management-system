import { DeliveryStatus } from '../../../enums/DeliveryStatus.js';
import { Notification as NotificationModel } from '../../../models/Notification.js';

// UC01's delivery records (§12.9), read for citizens reached. Read-only.
export class DeliveryRecordRepository {
  // Every status but QUEUED: the record has left the queue (§12.7's "sent").
  static #LEFT_QUEUE = [DeliveryStatus.SENT, DeliveryStatus.DELIVERED, DeliveryStatus.FAILED];

  #notificationModel;

  constructor({ notificationModel = NotificationModel } = {}) {
    this.#notificationModel = notificationModel;
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
    const records = await this.#notificationModel
      .find(
        {
          alert: { $in: alertIds },
          status: { $in: DeliveryRecordRepository.#LEFT_QUEUE },
          sentAt: { $gte: start, $lt: end },
        },
        'alert citizen channel status sentAt',
      )
      .lean();

    return records.map((record) => ({
      alert: String(record.alert),
      citizen: String(record.citizen),
      channel: record.channel,
      status: record.status,
      sentAt: record.sentAt,
    }));
  }
}
