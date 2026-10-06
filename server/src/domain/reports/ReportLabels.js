import { DismissalReason } from '../../enums/DismissalReason.js';
import { ReportHazardType } from '../../enums/ReportHazardType.js';

// How UC02's enum values read in messages to people (the app's chips and the
// web's dismiss dropdown use the same words): the notification text says
// "Rising river / Flood" and "Not a hazard", never the enum values.
export class ReportLabels {
  static #HAZARD_TYPES = Object.freeze({
    [ReportHazardType.RISING_RIVER_FLOOD]: 'Rising river / Flood',
    [ReportHazardType.LANDSLIDE]: 'Landslide',
    [ReportHazardType.BLOCKED_ROAD]: 'Blocked road',
    [ReportHazardType.OTHER]: 'Other',
  });

  static #DISMISSAL_REASONS = Object.freeze({
    [DismissalReason.INACCURATE]: 'Inaccurate',
    [DismissalReason.DUPLICATE]: 'Duplicate',
    [DismissalReason.NOT_A_HAZARD]: 'Not a hazard',
    [DismissalReason.INSUFFICIENT_EVIDENCE]: 'Insufficient evidence',
  });

  /**
   * @param {string} hazardType A ReportHazardType.
   * @returns {string} e.g. "Rising river / Flood"; the raw value if unknown.
   */
  static hazardType(hazardType) {
    return ReportLabels.#HAZARD_TYPES[hazardType] ?? hazardType;
  }

  /**
   * @param {string} reason A DismissalReason.
   * @returns {string} e.g. "Not a hazard"; the raw value if unknown.
   */
  static dismissalReason(reason) {
    return ReportLabels.#DISMISSAL_REASONS[reason] ?? reason;
  }
}
