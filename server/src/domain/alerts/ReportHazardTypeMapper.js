import { AlertHazardType } from '../../enums/AlertHazardType.js';
import { ReportHazardType } from '../../enums/ReportHazardType.js';

// UC01 A1: the alert hazard type a confirmed report suggests when an officer
// escalates it (PMP R-1, the UC02 class notes). Only the two report types that
// name a warnable hazard map to one. BLOCKED_ROAD and OTHER are ground-impact
// reports the officer interprets, so they suggest none. Every ReportHazardType
// must have an entry here, which a unit test enforces.
export class ReportHazardTypeMapper {
  static #MAP = Object.freeze({
    [ReportHazardType.RISING_RIVER_FLOOD]: AlertHazardType.FLOOD,
    [ReportHazardType.LANDSLIDE]: AlertHazardType.LANDSLIDE,
    [ReportHazardType.BLOCKED_ROAD]: null,
    [ReportHazardType.OTHER]: null,
  });

  /**
   * The report types this mapper covers, for the completeness test.
   * @returns {string[]}
   */
  static mappedTypes() {
    return Object.keys(ReportHazardTypeMapper.#MAP);
  }

  /**
   * The alert hazard type to pre-fill for a report's hazard type.
   * @param {string} reportHazardType A ReportHazardType.
   * @returns {string|null} An AlertHazardType, or null for a ground-impact report.
   * @throws {Error} For a value that isn't a ReportHazardType.
   */
  static toAlertHazardType(reportHazardType) {
    if (!Object.hasOwn(ReportHazardTypeMapper.#MAP, reportHazardType)) {
      throw new Error(`ReportHazardTypeMapper: unknown report hazard type "${reportHazardType}"`);
    }
    return ReportHazardTypeMapper.#MAP[reportHazardType];
  }
}
