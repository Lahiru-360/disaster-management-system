import { ReportSectionKey } from '../../enums/ReportSectionKey.js';
import { SriLankaCalendar } from '../../utils/SriLankaCalendar.js';

// How a post-event report is written to a file (UC04 step 13): the Strategy
// ExportService picks by format. Adding a format means writing one subclass
// and registering it with the service, with no other change (Open/Closed).
//
// Subclasses define format, mimeType and write(report). write takes the
// contract's report object (§14.2), as the report view gets it, and resolves
// to the file's bytes. It never changes the report.
export class ReportExporter {
  // The summary figures (§14.2), each with the section it comes from, in the
  // order the report view shows them. A figure is only shown when its section
  // was requested.
  static SUMMARY_FIGURES = Object.freeze([
    { figure: 'alertsIssued', section: ReportSectionKey.ALERT_TIMELINE, label: 'Alerts issued' },
    {
      figure: 'citizensReached',
      section: ReportSectionKey.CITIZENS_REACHED,
      label: 'Citizens reached',
    },
    {
      figure: 'citizensTargeted',
      section: ReportSectionKey.CITIZENS_REACHED,
      label: 'Citizens targeted',
    },
    { figure: 'reachedRate', section: ReportSectionKey.CITIZENS_REACHED, label: 'Reached rate' },
    {
      figure: 'peakOccupancy',
      section: ReportSectionKey.OCCUPANCY_OVER_TIME,
      label: 'Peak occupancy',
    },
    {
      figure: 'itemsDistributed',
      section: ReportSectionKey.RESOURCE_DISTRIBUTION,
      label: 'Items distributed',
    },
  ]);

  constructor() {
    if (new.target === ReportExporter) {
      throw new Error('ReportExporter is abstract; use one of its exporters');
    }
  }

  /** The ExportFormat this exporter writes. */
  get format() {
    throw new Error(`${this.constructor.name} must define format`);
  }

  /** The MIME type of the file it writes, e.g. "application/pdf". */
  get mimeType() {
    throw new Error(`${this.constructor.name} must define mimeType`);
  }

  /**
   * Writes the report to a file.
   * @param {object} report the report object (§14.2)
   * @returns {Promise<Buffer>} the file's bytes
   */
  // eslint-disable-next-line no-unused-vars
  async write(report) {
    throw new Error(`${this.constructor.name} must implement write(report)`);
  }

  /**
   * The summary figures of the requested sections, in view order.
   * @param {object} report the report object (§14.2)
   * @returns {Array<{ figure: string, section: string, label: string }>}
   */
  figuresOf(report) {
    const requested = new Set(report.sections.map((section) => section.key));
    return ReportExporter.SUMMARY_FIGURES.filter(({ section }) => requested.has(section));
  }

  /**
   * Every day inside a gap, by section: the days a file marks as incomplete.
   * @param {object} report the report object (§14.2)
   * @returns {Map<string, Set<string>>} section key -> "YYYY-MM-DD" days
   */
  gapDaysOf(report) {
    const days = new Map(report.sections.map((section) => [section.key, new Set()]));
    report.gaps.forEach((gap) =>
      SriLankaCalendar.daysBetween(gap.from, gap.to).forEach((day) =>
        days.get(gap.section)?.add(day),
      ),
    );
    return days;
  }
}
