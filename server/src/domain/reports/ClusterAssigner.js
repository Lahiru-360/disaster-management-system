// UC02 A4.2: decides which cluster a new report joins, from the reports
// DuplicateReportFinder matched. Pure - no database, no clock - so the rule is
// tested on its own:
// - no match: the report starts its own cluster (clusterId = its own id);
// - one or more: it joins the cluster of the OLDEST match, so a cluster keeps
//   the id it started with however many reports join it. Equal times are
//   settled by the smaller id, so the answer never depends on query order.
export class ClusterAssigner {
  // A4: a match must have been submitted within the last 2 hours.
  static WINDOW_MS = 2 * 60 * 60 * 1000;

  /**
   * The start of the duplicate window for a report submitted at `now`.
   * @param {Date} now
   * @returns {Date}
   */
  static windowStart(now) {
    return new Date(now.getTime() - ClusterAssigner.WINDOW_MS);
  }

  /**
   * @param {Array<{ _id: object|string, clusterId: object|string, submittedAt: Date }>} matches
   * @param {object|string} ownId The new report's id.
   * @returns {object|string} The clusterId the new report should take.
   */
  assign(matches, ownId) {
    if (!matches || matches.length === 0) {
      return ownId;
    }
    const oldest = matches.reduce((best, candidate) =>
      ClusterAssigner.#isOlder(candidate, best) ? candidate : best,
    );
    return oldest.clusterId;
  }

  static #isOlder(a, b) {
    const diff = a.submittedAt.getTime() - b.submittedAt.getTime();
    return diff !== 0 ? diff < 0 : String(a._id) < String(b._id);
  }
}
