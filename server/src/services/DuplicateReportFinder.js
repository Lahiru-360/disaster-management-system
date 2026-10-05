import { Coordinates } from '../domain/reports/Coordinates.js';
import { ReportStatus } from '../enums/ReportStatus.js';
import { HazardReport } from '../models/HazardReport.js';

// UC02 step 7 / A4: finds the reports a new one might duplicate - PENDING, the
// same hazard type, within 500 m and submitted since a given time. Only the
// query lives here; which cluster the new report joins is ClusterAssigner's
// call, and the time window (2 hours back from the clock) is the service's.
export class DuplicateReportFinder {
  static RADIUS_METRES = 500;

  #reportModel;

  /**
   * @param {object} [options]
   * @param {typeof HazardReport} [options.reportModel=HazardReport]
   */
  constructor({ reportModel = HazardReport } = {}) {
    this.#reportModel = reportModel;
  }

  /**
   * The PENDING reports of `hazardType` within 500 m of `location` that were
   * submitted at or after `since`, nearest first. Uses the 2dsphere index.
   * @param {Coordinates|{ latitude: number, longitude: number }} location
   * @param {string} hazardType A ReportHazardType.
   * @param {Date} since The start of the time window, inclusive.
   * @returns {Promise<Array<{ _id: object, clusterId: object, submittedAt: Date, referenceNo: string }>>}
   */
  async findNearbyPending(location, hazardType, since) {
    const point = location instanceof Coordinates ? location : new Coordinates(location);

    return this.#reportModel
      .find({
        status: ReportStatus.PENDING,
        hazardType,
        submittedAt: { $gte: since },
        location: {
          $near: {
            $geometry: point.toGeoJSON(),
            $maxDistance: DuplicateReportFinder.RADIUS_METRES,
          },
        },
      })
      .select('_id clusterId submittedAt referenceNo')
      .lean();
  }
}

export const duplicateReportFinder = new DuplicateReportFinder();
