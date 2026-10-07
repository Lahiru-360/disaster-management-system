import { AlertStatus } from '../../../enums/AlertStatus.js';
import { HazardAlert as HazardAlertModel } from '../../../models/HazardAlert.js';

// The hazard alerts a post-event report covers (§14.2 "Which alerts"), shared
// by the alert timeline and citizens reached so both count the same alerts.
// Read-only: it never writes an alert.
export class ReportAlertRepository {
  #alertModel;

  constructor({ alertModel = HazardAlertModel } = {}) {
    this.#alertModel = alertModel;
  }

  /**
   * Every issued alert (not DRAFT) linked to the report's event or to no
   * event, with a status change inside the range, whose scope covers at least
   * one selected district. A river basin covers every district it spans. With
   * a hazard type filter (A1), only alerts of that type.
   *
   * Each comes back as `{ id, referenceNo, hazardType, severity, areas,
   * history }`: areas are `[{ kind, id, name }]`, and history holds the
   * non-DRAFT status changes `{ status, version, at, severity, areas }`, where
   * severity and areas are null until §12.1 records them per change (§14.7).
   * @param {import('../../../domain/analysis/ReportContext.js').ReportContext} ctx
   * @returns {Promise<object[]>}
   */
  async findForReport(ctx) {
    const { start, end } = ctx.instants();
    const docs = await this.#alertModel
      .find({
        status: { $ne: AlertStatus.DRAFT },
        ...(ctx.filters.hazardType ? { hazardType: ctx.filters.hazardType } : {}),
        $or: [{ event: ctx.event.eventId }, { event: null }],
        statusHistory: {
          $elemMatch: { status: { $ne: AlertStatus.DRAFT }, at: { $gte: start, $lt: end } },
        },
      })
      .populate('targets.area')
      .lean();

    return docs
      .filter((doc) =>
        ReportAlertRepository.#districtsCovered(doc).some((id) => ctx.includesDistrict(id)),
      )
      .map((doc) => ReportAlertRepository.#toAlert(doc));
  }

  // A District target covers itself; a RiverBasin covers the districts it spans.
  static #districtsCovered(doc) {
    return doc.targets
      .filter((target) => target.area)
      .flatMap((target) =>
        target.kind === 'RiverBasin' ? target.area.districts : [target.area._id],
      )
      .map(String);
  }

  static #toAlert(doc) {
    const areas = doc.targets
      .filter((target) => target.area)
      .map((target) => ({
        kind: target.kind,
        id: String(target.area._id),
        name: target.area.name,
      }));
    const names = new Map(areas.map((area) => [area.id, area.name]));

    return {
      id: String(doc._id),
      referenceNo: doc.referenceNo,
      hazardType: doc.hazardType,
      severity: doc.severity,
      areas,
      history: doc.statusHistory
        .filter((entry) => entry.status !== AlertStatus.DRAFT)
        .map((entry) => ({
          status: entry.status,
          version: entry.version,
          at: entry.at,
          severity: entry.severity ?? null,
          areas: Array.isArray(entry.targets)
            ? entry.targets.map((target) => ({
                kind: target.kind,
                id: String(target.area),
                name: names.get(String(target.area)) ?? null,
              }))
            : null,
        })),
    };
  }
}
