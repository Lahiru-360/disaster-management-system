import mongoose from 'mongoose';
import { ReportContext } from '../domain/analysis/ReportContext.js';
import { HazardEvent } from '../domain/events/HazardEvent.js';
import { HazardEvent as HazardEventModel } from '../models/HazardEvent.js';
import { Organisation as OrganisationModel } from '../models/Organisation.js';
import { PostEventReport as PostEventReportModel } from '../models/PostEventReport.js';
import { ApiError } from '../utils/ApiError.js';
import { systemClock } from '../utils/SystemClock.js';
import { PostEventReportPresenter } from './reports/PostEventReportPresenter.js';
import { ReportBuilder } from './reports/ReportBuilder.js';

// UC04 Generate Post-Event Analysis Report (contract §14): generates a report
// for a closed hazard event through the ReportBuilder, stores it, and reads
// stored reports back, and refines a stored report with the A1 filters
// (DMS-156). Read-only towards the data it reports on: the report is the only
// record it writes.
export class PostEventReportService {
  static RECENT_LIMIT = 20;

  #reportModel;
  #eventModel;
  #organisationModel;
  #builder;
  #clock;

  constructor({
    reportModel = PostEventReportModel,
    eventModel = HazardEventModel,
    organisationModel = OrganisationModel,
    builder = new ReportBuilder(),
    clock = systemClock,
  } = {}) {
    this.#reportModel = reportModel;
    this.#eventModel = eventModel;
    this.#organisationModel = organisationModel;
    this.#builder = builder;
    this.#clock = clock;
  }

  /**
   * UC04 steps 4-11 (§14.3): compiles the requested sections for the event,
   * range and districts, stores the report and returns it.
   * @param {{ id: string }} officer the signed-in DMC or duty officer
   * @param {{ eventId: string, from: string, to: string, districtIds: string[], sections: string[] }} params
   * @returns {Promise<object>} the report object (§14.2)
   */
  async generate(officer, { eventId, from, to, districtIds, sections }) {
    const eventDoc = await this.#eventModel.findById(eventId).lean();
    if (!eventDoc) {
      throw new ApiError(404, 'NOT_FOUND', 'Hazard event not found.');
    }
    const event = HazardEvent.fromDocument(eventDoc);

    const ctx = new ReportContext({
      event,
      dateFrom: from,
      dateTo: to,
      districtIds: PostEventReportService.#inEventOrder(event, districtIds),
      clock: this.#clock,
    });
    return this.#buildAndStore(officer, ctx, sections);
  }

  /**
   * UC04 A1 (§14.9): compiles the stored report's own selection again with
   * the filters, which replace any it had, and stores the result as a new
   * report. The stored report is not changed.
   * @param {{ id: string }} officer the signed-in DMC or duty officer
   * @param {string} reportId
   * @param {{ hazardType?: string|null, districtId?: string|null, organisationId?: string|null }} filters
   * @returns {Promise<object>} the new report object (§14.2)
   */
  async refine(officer, reportId, filters) {
    const doc = mongoose.isValidObjectId(reportId)
      ? await this.#reportModel.findById(reportId).lean()
      : null;
    if (!doc) {
      throw new ApiError(404, 'NOT_FOUND', 'Post-event report not found.');
    }
    const wanted = {
      hazardType: filters.hazardType ?? null,
      districtId: filters.districtId ?? null,
      organisationId: filters.organisationId ?? null,
    };
    const districtIds = doc.districts.map(String);
    if (Object.values(wanted).every((value) => value === null)) {
      throw PostEventReportService.#invalid('filters', 'must set at least one filter');
    }
    if (wanted.districtId !== null && !districtIds.includes(String(wanted.districtId))) {
      throw PostEventReportService.#invalid('districtId', "must be one of the report's districts");
    }
    if (
      wanted.organisationId !== null &&
      !(await this.#organisationModel.exists({ _id: wanted.organisationId }))
    ) {
      throw new ApiError(404, 'NOT_FOUND', 'Organisation not found.');
    }

    const eventDoc = await this.#eventModel.findById(doc.event).lean();
    if (!eventDoc) {
      throw new ApiError(404, 'NOT_FOUND', 'Hazard event not found.');
    }
    const ctx = new ReportContext({
      event: HazardEvent.fromDocument(eventDoc),
      dateFrom: doc.dateFrom,
      dateTo: doc.dateTo,
      districtIds,
      filters: wanted,
      clock: this.#clock,
    });
    return this.#buildAndStore(
      officer,
      ctx,
      doc.sections.map((section) => section.key),
    );
  }

  /**
   * A stored report, exactly as generated (§14.4). Any DMC officer may open
   * any report.
   * @param {string} id
   * @returns {Promise<object>}
   */
  async findById(id) {
    const doc = mongoose.isValidObjectId(id) ? await this.#reportModel.findById(id) : null;
    if (!doc) {
      throw new ApiError(404, 'NOT_FOUND', 'Post-event report not found.');
    }
    return PostEventReportPresenter.present(doc);
  }

  /**
   * The newest reports for an event, for the Recent reports list (§14.5).
   * @param {string} eventId
   * @returns {Promise<object[]>}
   */
  async listForEvent(eventId) {
    const docs = await this.#reportModel
      .find({ event: eventId }, '-sections -summary')
      .sort({ generatedAt: -1, _id: -1 })
      .limit(PostEventReportService.RECENT_LIMIT)
      .populate(PostEventReportPresenter.POPULATE)
      .lean();
    return docs.map((doc) => PostEventReportPresenter.listItem(doc));
  }

  // Steps 6-11 for a context: compiles the sections, refuses an empty
  // selection, and stores the report with the context's filters.
  async #buildAndStore(officer, ctx, sectionKeys) {
    const { report, summary, isEmpty } = await this.#builder.build(ctx, {
      sectionKeys,
      generatedBy: officer.id,
    });
    // E2: a selection with no records in any requested section is not a
    // report, so nothing is stored (404 NO_DATA_FOR_SELECTION).
    if (isEmpty) {
      throw new ApiError(404, 'NO_DATA_FOR_SELECTION', 'No data is available for this selection.');
    }

    const doc = await this.#reportModel.create({
      event: report.eventId,
      generatedBy: report.generatedBy,
      generatedAt: report.generatedAt,
      dateFrom: report.dateFrom,
      dateTo: report.dateTo,
      districts: report.districts,
      filters: ctx.filters,
      summary,
      sections: report.sections,
      gaps: report.gaps.map((gap) => gap.toJSON()),
    });
    return PostEventReportPresenter.present(doc);
  }

  static #invalid(field, message) {
    return new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [
      { field, message },
    ]);
  }

  // The selected districts in the order the event lists them (§14.2).
  static #inEventOrder(event, districtIds) {
    const selected = new Set(districtIds.map(String));
    const eventOrder = event.districts.map(String).filter((id) => selected.has(id));
    const others = [...selected].filter((id) => !eventOrder.includes(id));
    return [...eventOrder, ...others];
  }
}

export const postEventReportService = new PostEventReportService();
