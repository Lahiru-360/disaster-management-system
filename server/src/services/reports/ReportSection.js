import { DataGap } from '../../domain/analysis/DataGap.js';
import { GapDetector } from '../../domain/analysis/GapDetector.js';

// One section of a post-event report: the Strategy the report builder loops
// over (UC04 steps 6-9). Replaces the original StatisticalReport's four
// calculate methods, so adding a section means writing one subclass and
// registering it, with no change to the builder (Open/Closed).
//
// Subclasses define key, gapReason and compile(ctx). compile resolves to
// { result, isEmpty, gaps }: result is the section's own shape (§14.2), isEmpty
// is true when the range has no records at all, and gaps are the DataGaps for
// days with none.
export class ReportSection {
  constructor() {
    if (new.target === ReportSection) {
      throw new Error('ReportSection is abstract; use one of its sections');
    }
  }

  /** The section's ReportSectionKey. */
  get key() {
    throw new Error(`${this.constructor.name} must define key`);
  }

  /** Why a day with no records is a gap, e.g. "No occupancy records". */
  get gapReason() {
    throw new Error(`${this.constructor.name} must define gapReason`);
  }

  /**
   * Compiles the section against the report's selection.
   * @param {import('../../domain/analysis/ReportContext.js').ReportContext} ctx
   * @returns {Promise<{ result: object, isEmpty: boolean, gaps: DataGap[] }>}
   */
  // eslint-disable-next-line no-unused-vars
  async compile(ctx) {
    throw new Error(`${this.constructor.name} must implement compile(ctx)`);
  }

  /**
   * The gaps in this section: every run of days in the range without a record.
   * @param {import('../../domain/analysis/ReportContext.js').ReportContext} ctx
   * @param {Iterable<string>} recordDays the days that have records
   * @returns {DataGap[]}
   */
  findGaps(ctx, recordDays) {
    return GapDetector.findGaps(ctx.days(), recordDays).map(
      ({ from, to }) => new DataGap({ section: this.key, from, to, reason: this.gapReason }),
    );
  }
}
