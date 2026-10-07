import { ReportSectionKey } from '../../../enums/ReportSectionKey.js';
import { ReportAlertRepository } from '../repositories/ReportAlertRepository.js';
import { ReportSection } from '../ReportSection.js';

// UC04 step 6: every alert issued for the event, as one timeline entry per
// status change inside the range: issued (BROADCAST), each update (UPDATED,
// with its version) and the all-clear (CANCELLED).
export class AlertTimelineSection extends ReportSection {
  #alerts;

  constructor({ alerts = new ReportAlertRepository() } = {}) {
    super();
    this.#alerts = alerts;
  }

  get key() {
    return ReportSectionKey.ALERT_TIMELINE;
  }

  get gapReason() {
    return 'No alert records';
  }

  /**
   * @param {{ alerts: number }} result
   * @returns {{ alertsIssued: number }}
   */
  summarise(result) {
    return { alertsIssued: result.alerts };
  }

  /**
   * @param {import('../../../domain/analysis/ReportContext.js').ReportContext} ctx
   * @returns {Promise<{ result: object, isEmpty: boolean, gaps: import('../../../domain/analysis/DataGap.js').DataGap[] }>}
   */
  async compile(ctx) {
    const alerts = await this.#alerts.findForReport(ctx);

    const entries = alerts
      .flatMap((alert) =>
        alert.history
          .filter((change) => ctx.dayOf(change.at) !== null)
          .map((change) => ({
            at: new Date(change.at).toISOString(),
            date: ctx.dayOf(change.at),
            alert: { id: alert.id, referenceNo: alert.referenceNo },
            status: change.status,
            version: change.version,
            hazardType: alert.hazardType,
            // The values at that change once §12.1 records them; until then, the current ones.
            severity: change.severity ?? alert.severity,
            areas: change.areas ?? alert.areas,
          })),
      )
      .sort(
        (a, b) =>
          a.at.localeCompare(b.at) ||
          a.alert.referenceNo.localeCompare(b.alert.referenceNo) ||
          a.version - b.version,
      );

    const perDay = new Map();
    entries.forEach((entry) => perDay.set(entry.date, (perDay.get(entry.date) ?? 0) + 1));

    return {
      result: {
        alerts: new Set(entries.map((entry) => entry.alert.id)).size,
        entries,
        days: ctx.days().map((date) => ({ date, entries: perDay.get(date) ?? null })),
      },
      isEmpty: entries.length === 0,
      gaps: this.findGaps(ctx, perDay.keys()),
    };
  }
}
