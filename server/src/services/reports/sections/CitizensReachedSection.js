import { Channel } from '../../../enums/Channel.js';
import { DeliveryStatus } from '../../../enums/DeliveryStatus.js';
import { ReportSectionKey } from '../../../enums/ReportSectionKey.js';
import { DeliveryRecordRepository } from '../repositories/DeliveryRecordRepository.js';
import { ReportAlertRepository } from '../repositories/ReportAlertRepository.js';
import { ReportSection } from '../ReportSection.js';

// UC04 step 7: how many citizens the event's alerts reached, and how well each
// channel delivered. A citizen counts once however many channels or alerts
// reached them, and only with at least one DELIVERED record.
export class CitizensReachedSection extends ReportSection {
  #alerts;
  #deliveries;

  constructor({
    alerts = new ReportAlertRepository(),
    deliveries = new DeliveryRecordRepository(),
  } = {}) {
    super();
    this.#alerts = alerts;
    this.#deliveries = deliveries;
  }

  get key() {
    return ReportSectionKey.CITIZENS_REACHED;
  }

  get gapReason() {
    return 'No delivery records';
  }

  /**
   * @param {import('../../../domain/analysis/ReportContext.js').ReportContext} ctx
   * @returns {Promise<{ result: object, isEmpty: boolean, gaps: import('../../../domain/analysis/DataGap.js').DataGap[] }>}
   */
  async compile(ctx) {
    const alerts = CitizensReachedSection.#inTimelineOrder(
      await this.#alerts.findForReport(ctx),
      ctx,
    );
    const { start, end } = ctx.instants();
    const records = await this.#deliveries.findSent({
      alertIds: alerts.map((alert) => alert.id),
      start,
      end,
    });

    const totals = CitizensReachedSection.#count(records);
    const perDay = new Map();
    records.forEach((record) => {
      const day = ctx.dayOf(record.sentAt);
      const counts = perDay.get(day) ?? { attempted: 0, delivered: 0 };
      counts.attempted += 1;
      counts.delivered += record.status === DeliveryStatus.DELIVERED ? 1 : 0;
      perDay.set(day, counts);
    });

    return {
      result: {
        citizensReached: totals.reached,
        citizensTargeted: totals.targeted,
        reachedRate: totals.targeted === 0 ? null : totals.reached / totals.targeted,
        perChannel: CitizensReachedSection.#perChannel(records, true),
        perAlert: alerts.map((alert) => {
          const ofAlert = records.filter((record) => record.alert === alert.id);
          return {
            alert: { id: alert.id, referenceNo: alert.referenceNo },
            citizensReached: CitizensReachedSection.#count(ofAlert).reached,
            perChannel: CitizensReachedSection.#perChannel(ofAlert, false),
          };
        }),
        days: ctx.days().map((date) => ({
          date,
          attempted: perDay.get(date)?.attempted ?? null,
          delivered: perDay.get(date)?.delivered ?? null,
        })),
      },
      isEmpty: records.length === 0,
      gaps: this.findGaps(ctx, perDay.keys()),
    };
  }

  // Distinct citizens with any record, and with at least one DELIVERED.
  static #count(records) {
    const targeted = new Set(records.map((record) => record.citizen));
    const reached = new Set(
      records
        .filter((record) => record.status === DeliveryStatus.DELIVERED)
        .map((record) => record.citizen),
    );
    return { targeted: targeted.size, reached: reached.size };
  }

  // One row per channel, always all three in Channel order.
  static #perChannel(records, withRates) {
    return Object.values(Channel).map((channel) => {
      const ofChannel = records.filter((record) => record.channel === channel);
      const attempted = ofChannel.length;
      const delivered = ofChannel.filter((r) => r.status === DeliveryStatus.DELIVERED).length;
      if (!withRates) {
        return { channel, attempted, delivered };
      }
      return {
        channel,
        attempted,
        delivered,
        failed: ofChannel.filter((r) => r.status === DeliveryStatus.FAILED).length,
        deliveryRate: attempted === 0 ? null : delivered / attempted,
      };
    });
  }

  // The timeline's order: by each alert's first change inside the range, then
  // reference number.
  static #inTimelineOrder(alerts, ctx) {
    const firstAt = (alert) =>
      Math.min(
        ...alert.history
          .filter((change) => ctx.dayOf(change.at) !== null)
          .map((change) => new Date(change.at).getTime()),
      );
    return [...alerts].sort(
      (a, b) => firstAt(a) - firstAt(b) || a.referenceNo.localeCompare(b.referenceNo),
    );
  }
}
