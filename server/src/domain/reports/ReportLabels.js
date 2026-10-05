import { ReportHazardType } from '../../enums/ReportHazardType.js';

// How UC02's enum values read in messages to people (the app's chips use the
// same words): the notification text says "Rising river / Flood", never
// RISING_RIVER_FLOOD.
export class ReportLabels {
  static #HAZARD_TYPES = Object.freeze({
    [ReportHazardType.RISING_RIVER_FLOOD]: 'Rising river / Flood',
    [ReportHazardType.LANDSLIDE]: 'Landslide',
    [ReportHazardType.BLOCKED_ROAD]: 'Blocked road',
    [ReportHazardType.OTHER]: 'Other',
  });

  /**
   * @param {string} hazardType A ReportHazardType.
   * @returns {string} e.g. "Rising river / Flood"; the raw value if unknown.
   */
  static hazardType(hazardType) {
    return ReportLabels.#HAZARD_TYPES[hazardType] ?? hazardType;
  }
}
