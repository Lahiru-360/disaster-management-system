import mongoose from 'mongoose';
import { ReportContext } from '../domain/analysis/ReportContext.js';
import { HazardEvent } from '../domain/events/HazardEvent.js';
import { HazardEvent as HazardEventModel } from '../models/HazardEvent.js';
import { PostEventReport as PostEventReportModel } from '../models/PostEventReport.js';
import { ApiError } from '../utils/ApiError.js';
import { systemClock } from '../utils/SystemClock.js';
import { PostEventReportPresenter } from './reports/PostEventReportPresenter.js';
import { ReportBuilder } from './reports/ReportBuilder.js';

// UC04 Generate Post-Event Analysis Report (contract §14): generates a report
// for a closed hazard event through the ReportBuilder, stores it, and reads
// stored reports back. Read-only towards the data it reports on: the report
// is the only record it writes.
export class PostEventReportService {
  static RECENT_LIMIT = 20;

  #reportModel;
  #eventModel;
  #builder;
  #clock;

  constructor({
    reportModel = PostEventReportModel,
    eventModel = HazardEventModel,
    builder = new ReportBuilder(),
    clock = systemClock,
  } = {}) {
    this.#reportModel = reportModel;
    this.#eventModel = eventModel;
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
    const { report, summary } = await this.#builder.build(ctx, {
      sectionKeys: sections,
      generatedBy: officer.id,
    });

    const doc = await this.#reportModel.create({
      event: report.eventId,
      generatedBy: report.generatedBy,
      generatedAt: report.generatedAt,
      dateFrom: report.dateFrom,
      dateTo: report.dateTo,
      districts: report.districts,
      summary,
      sections: report.sections,
      gaps: report.gaps.map((gap) => gap.toJSON()),
    });
    return PostEventReportPresenter.present(doc);
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

  // The selected districts in the order the event lists them (§14.2).
  static #inEventOrder(event, districtIds) {
    const selected = new Set(districtIds.map(String));
    const eventOrder = event.districts.map(String).filter((id) => selected.has(id));
    const others = [...selected].filter((id) => !eventOrder.includes(id));
    return [...eventOrder, ...others];
  }
}

export const postEventReportService = new PostEventReportService();
