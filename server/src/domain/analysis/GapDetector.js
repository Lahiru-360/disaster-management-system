// Finds the days of a report range that have no records at all (UC04 step 10),
// so a section can mark them as incomplete data instead of leaving them out.
// Pure: it only compares days, and never reads the database or the clock.
export class GapDetector {
  /**
   * The runs of days in `days` that are missing from `recordDays`, with
   * consecutive missing days merged into one `{ from, to }` range. Days are
   * "YYYY-MM-DD" strings; `days` is the whole range in order, as
   * ReportContext.days() gives it. Record days outside the range are ignored.
   * @param {string[]} days
   * @param {Iterable<string>} recordDays
   * @returns {Array<{ from: string, to: string }>}
   */
  static findGaps(days, recordDays) {
    const withRecords = new Set(recordDays);
    const gaps = [];
    let open = null;
    for (const day of days) {
      if (withRecords.has(day)) {
        open = null;
      } else if (open) {
        open.to = day;
      } else {
        open = { from: day, to: day };
        gaps.push(open);
      }
    }
    return gaps;
  }
}
