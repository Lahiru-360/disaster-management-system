import mongoose from 'mongoose';
import { fallbackPolicy as defaultFallbackPolicy } from '../domain/alerts/FallbackPolicy.js';
import { Channel } from '../enums/Channel.js';
import { DeliveryStatus } from '../enums/DeliveryStatus.js';
import { District as DistrictModel } from '../models/District.js';
import { Notification as NotificationModel } from '../models/Notification.js';
import { User as UserModel } from '../models/User.js';

// The delivery summary of one alert version (UC01 step 14, contract §12.7),
// counted from the stored delivery records with one aggregation, so it always
// matches what was recorded. Reused for the first broadcast, each update (A2),
// the all-clear (A3) and the fallback results (E3).
export class DeliverySummary {
  // Every channel the summary reports, in this order, even with no records.
  static CHANNELS = Object.values(Channel);

  #notificationModel;
  #userModel;
  #districtModel;
  #fallback;

  constructor({
    notificationModel = NotificationModel,
    userModel = UserModel,
    districtModel = DistrictModel,
    fallback = defaultFallbackPolicy,
  } = {}) {
    this.#notificationModel = notificationModel;
    this.#userModel = userModel;
    this.#districtModel = districtModel;
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
      DeliverySummary.#ofVersion(alertId, version),
      {
        $facet: {
          byChannel: [
            { $group: { _id: { channel: '$channel', status: '$status' }, count: { $sum: 1 } } },
          ],
          // A citizen is reached when any channel ended DELIVERED.
          unreached: [...DeliverySummary.#unreachedStages(), { $count: 'count' }],
          // A resend marks the record it resends, on whichever channel (E3).
          resent: [{ $match: { fallbackChannel: { $ne: null } } }, { $count: 'count' }],
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

  /**
   * E3.3 (contract §12.16): one page of the distinct citizens of an alert
   * version for whom no channel ended DELIVERED, by name then id, with their
   * home district and phone. The total matches the summary's unreachedCount.
   * @param {string} alertId
   * @param {number} version
   * @param {{ page: number, limit: number }} paging
   * @returns {Promise<{ citizens: { id: string, name: string,
   *   district: { id: string, name: string } | null, phone: string | null }[],
   *   total: number }>}
   */
  async unreachedCitizens(alertId, version, { page, limit }) {
    const [result] = await this.#notificationModel.aggregate([
      DeliverySummary.#ofVersion(alertId, version),
      ...DeliverySummary.#unreachedStages(),
      {
        $lookup: {
          from: this.#userModel.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'citizen',
          pipeline: [{ $project: { name: 1, phone: 1, homeDistrict: 1 } }],
        },
      },
      { $unwind: '$citizen' },
      { $sort: { 'citizen.name': 1, _id: 1 } },
      {
        $facet: {
          total: [{ $count: 'count' }],
          page: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: this.#districtModel.collection.name,
                localField: 'citizen.homeDistrict',
                foreignField: '_id',
                as: 'district',
                pipeline: [{ $project: { name: 1 } }],
              },
            },
          ],
        },
      },
    ]);

    return {
      citizens: result.page.map(({ citizen, district: [district] }) => ({
        id: citizen._id.toString(),
        name: citizen.name,
        district: district ? { id: district._id.toString(), name: district.name } : null,
        phone: citizen.phone ?? null,
      })),
      total: result.total[0]?.count ?? 0,
    };
  }

  static #ofVersion(alertId, version) {
    return {
      $match: { alert: new mongoose.Types.ObjectId(String(alertId)), alertVersion: version },
    };
  }

  // One row per citizen of the version that no channel reached: a citizen is
  // reached when any of their deliveries ended DELIVERED (E3.3).
  static #unreachedStages() {
    return [
      {
        $group: {
          _id: '$citizen',
          reached: {
            $max: { $cond: [{ $eq: ['$status', DeliveryStatus.DELIVERED] }, 1, 0] },
          },
        },
      },
      { $match: { reached: 0 } },
    ];
  }
}

export const deliverySummary = new DeliverySummary();
