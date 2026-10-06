import { PostEventReport } from '../../domain/analysis/PostEventReport.js';
import { AlertTimelineSection } from './sections/AlertTimelineSection.js';
import { CitizensReachedSection } from './sections/CitizensReachedSection.js';
import { OccupancyOverTimeSection } from './sections/OccupancyOverTimeSection.js';
import { ResourceDistributionSection } from './sections/ResourceDistributionSection.js';

// Builds a post-event report (UC04 steps 6-11): loops over the requested
// sections, in the order they are registered, compiles each against the same
// ReportContext, and collects their results, gaps and summary figures.
//
// The sections are injected, so a fifth section is one new ReportSection
// registered in the list: nothing here changes (Open/Closed).
export class ReportBuilder {
  // Every summary figure, null until a requested section provides it (§14.2).
  static #EMPTY_SUMMARY = Object.freeze({
    alertsIssued: null,
    citizensReached: null,
    citizensTargeted: null,
    reachedRate: null,
    peakOccupancy: null,
    peakOccupancyDate: null,
    itemsDistributed: null,
  });

  #sections;

  /**
   * @param {object} [deps]
   * @param {import('./ReportSection.js').ReportSection[]} [deps.sections] in report order
   */
  constructor({ sections = ReportBuilder.defaultSections() } = {}) {
    this.#sections = [...sections];
  }

  /** The four UC04 sections, in report order. */
  static defaultSections() {
    return [
      new AlertTimelineSection(),
      new CitizensReachedSection(),
      new OccupancyOverTimeSection(),
      new ResourceDistributionSection(),
    ];
  }

  /** The keys of the registered sections, in report order. */
  get sectionKeys() {
    return this.#sections.map((section) => section.key);
  }

  /**
   * Compiles the requested sections, one after another, into a report that is
   * not stored yet. generatedAt comes from the context's clock.
   * @param {import('../../domain/analysis/ReportContext.js').ReportContext} ctx
   * @param {{ sectionKeys: string[], generatedBy: string }} params
   * @returns {Promise<{ report: PostEventReport, summary: object }>}
   */
  async build(ctx, { sectionKeys, generatedBy }) {
    const unknown = sectionKeys.filter((key) => !this.sectionKeys.includes(key));
    if (unknown.length > 0) {
      throw new Error(`No report section registered for: ${unknown.join(', ')}`);
    }

    const report = new PostEventReport({
      eventId: ctx.event.eventId,
      generatedBy,
      generatedAt: ctx.clock.now(),
      dateFrom: ctx.dateFrom,
      dateTo: ctx.dateTo,
      districts: ctx.districtIds,
    });
    const summary = { ...ReportBuilder.#EMPTY_SUMMARY };

    for (const section of this.#sections.filter((s) => sectionKeys.includes(s.key))) {
      const { result, gaps } = await section.compile(ctx);
      report.addSection({ key: section.key, result, gaps });
      Object.assign(summary, section.summarise(result));
    }

    return { report, summary };
  }
}
