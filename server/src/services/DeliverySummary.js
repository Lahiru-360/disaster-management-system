import mongoose from 'mongoose';
import { fallbackPolicy as defaultFallbackPolicy } from '../domain/alerts/FallbackPolicy.js';
import { Channel } from '../enums/Channel.js';
import { DeliveryStatus } from '../enums/DeliveryStatus.js';
import { Notification as NotificationModel } from '../models/Notification.js';

// The delivery summary of one alert version (UC01 step 14, contract §12.7),
// counted from the stored delivery records with one aggregation, so it always
// matches what was recorded. Reused for the first broadcast, each update (A2),
// the all-clear (A3) and the fallback results (E3).
export class DeliverySummary {
  // Every channel the summary reports, in this order, even with no records.
  static CHANNELS = Object.values(Channel);

  #notificationModel;
  #fallback;

  constructor({ notificationModel = NotificationModel, fallback = defaultFallbackPolicy } = {}) {
    this.#notificationModel = notificationModel;
    this.#fallback = fallback;
  }

  /**
   * @param {string} alertId
   * @param {number} version The alert version the deliveries were for.
   * @returns {Promise<{ version: number,
   *   perChannel: { channel: string, sent: number, delivered: number, failed: number }[],
   *   totals: { sent: number, delivered: number, failed: number },
   *   fallback: { channel: string, resent: number }, unreachedCount: number }>}
   */
  async forAlert(alertId, version) {
    const [result] = await this.#notificationModel.aggregate([
      { $match: { alert: new mongoose.Types.ObjectId(String(alertId)), alertVersion: version } },
      {
        $facet: {
          byChannel: [
            { $group: { _id: { channel: '$channel', status: '$status' }, count: { $sum: 1 } } },
          ],
          // A citizen is reached when any channel ended DELIVERED.
          unreached: [
            {
              $group: {
                _id: '$citizen',
                reached: {
                  $max: { $cond: [{ $eq: ['$status', DeliveryStatus.DELIVERED] }, 1, 0] },
                },
              },
            },
            { $match: { reached: 0 } },
            { $count: 'count' },
          ],
          // A retry adds attempts on the record it retries (E3, DMS-128).
          resent: [{ $match: { attempts: { $gt: 1 } } }, { $count: 'count' }],
        },
      },
    ]);

    const count = (channel, statuses) =>
      result.byChannel
        .filter(({ _id }) => _id.channel === channel && statuses.includes(_id.status))
        .reduce((sum, { count: n }) => sum + n, 0);

    const perChannel = DeliverySummary.CHANNELS.map((channel) => ({
      channel,
      // Every delivery that left the queue (contract §12.7).
      sent: count(channel, [DeliveryStatus.SENT, DeliveryStatus.DELIVERED, DeliveryStatus.FAILED]),
      delivered: count(channel, [DeliveryStatus.DELIVERED]),
      failed: count(channel, [DeliveryStatus.FAILED]),
    }));
    const total = (field) => perChannel.reduce((sum, row) => sum + row[field], 0);

    return {
      version,
      perChannel,
      totals: { sent: total('sent'), delivered: total('delivered'), failed: total('failed') },
      fallback: {
        channel: this.#fallback.channel,
        resent: result.resent[0]?.count ?? 0,
      },
      unreachedCount: result.unreached[0]?.count ?? 0,
    };
  }
}

export const deliverySummary = new DeliverySummary();
