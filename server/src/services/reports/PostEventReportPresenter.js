// Every model a report references, so populate() finds each one registered.
import '../../models/District.js';
import '../../models/HazardEvent.js';
import '../../models/User.js';

// Turns a stored PostEventReport into the contract's report object (§14.2):
// the event, officer and districts as small references, plus hasGaps. Section
// results are returned exactly as they were stored.
export class PostEventReportPresenter {
  static POPULATE = [
    { path: 'event', select: 'name hazardType startDate endDate' },
    { path: 'generatedBy', select: 'name' },
    { path: 'districts', select: 'name' },
  ];

  /**
   * The full report, for generating (§14.3) and reading one back (§14.4).
   * @param {import('mongoose').Document} doc A PostEventReport document.
   * @returns {Promise<object>}
   */
  static async present(doc) {
    await doc.populate(PostEventReportPresenter.POPULATE);
    const json = doc.toObject();
    return {
      ...PostEventReportPresenter.#header(json),
      event: PostEventReportPresenter.#event(json.event),
      summary: json.summary,
      hasGaps: json.gaps.length > 0,
      gaps: json.gaps,
      sections: json.sections,
      createdAt: json.createdAt,
    };
  }

  /**
   * A row of the recent reports list (§14.5): the report without its summary,
   * gaps, sections and createdAt. Expects the document already populated.
   * @param {object} json A populated, lean PostEventReport.
   * @returns {object}
   */
  static listItem(json) {
    return {
      ...PostEventReportPresenter.#header(json),
      event: { id: String(json.event._id), name: json.event.name },
      hasGaps: json.gaps.length > 0,
    };
  }

  // The fields every presentation shares, in contract order.
  static #header(json) {
    return {
      id: String(json._id),
      event: null,
      // null if the officer's account has since been removed.
      generatedBy: json.generatedBy
        ? { id: String(json.generatedBy._id), name: json.generatedBy.name }
        : null,
      generatedAt: json.generatedAt,
      dateFrom: json.dateFrom,
      dateTo: json.dateTo,
      districts: json.districts.map((district) => ({
        id: String(district._id),
        name: district.name,
      })),
      filters: {
        hazardType: json.filters?.hazardType ?? null,
        districtId: json.filters?.districtId ? String(json.filters.districtId) : null,
        organisationId: json.filters?.organisationId ? String(json.filters.organisationId) : null,
      },
    };
  }

  static #event(event) {
    return {
      id: String(event._id),
      name: event.name,
      hazardType: event.hazardType,
      startDate: event.startDate,
      endDate: event.endDate,
    };
  }
}
