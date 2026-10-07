import { SriLankaCalendar } from '../../utils/SriLankaCalendar.js';
import { systemClock } from '../../utils/SystemClock.js';

// What every ReportSection compiles against: the closed event, the inclusive
// range of Sri Lanka calendar days, the selected districts, the A1 filters and
// the clock. Built once per report, so all four sections see the same
// selection, and read-only, so no section can change it for the next.
export class ReportContext {
  #event;
  #dateFrom;
  #dateTo;
  #districtIds;
  #filters;
  #clock;

  /**
   * @param {object} params
   * @param {import('../events/HazardEvent.js').HazardEvent} params.event
   * @param {string} params.dateFrom "YYYY-MM-DD", included
   * @param {string} params.dateTo "YYYY-MM-DD", included
   * @param {string[]} params.districtIds at least one
   * @param {{ hazardType?: string|null, districtId?: string|null, organisationId?: string|null }} [params.filters]
   * @param {{ now: () => Date }} [params.clock]
   */
  constructor({
    event,
    dateFrom,
    dateTo,
    districtIds = [],
    filters = {},
    clock = systemClock,
  } = {}) {
    if (!event) {
      throw new Error('ReportContext needs an event');
    }
    if (!SriLankaCalendar.isDay(dateFrom) || !SriLankaCalendar.isDay(dateTo)) {
      throw new Error('ReportContext needs dateFrom and dateTo as YYYY-MM-DD days');
    }
    if (dateFrom > dateTo) {
      throw new Error('ReportContext dateFrom must not be after dateTo');
    }
    if (districtIds.length === 0) {
      throw new Error('ReportContext needs at least one district');
    }
    this.#event = event;
    this.#dateFrom = dateFrom;
    this.#dateTo = dateTo;
    this.#districtIds = Object.freeze(districtIds.map(String));
    this.#filters = Object.freeze({
      hazardType: filters.hazardType ?? null,
      districtId: filters.districtId == null ? null : String(filters.districtId),
      organisationId: filters.organisationId == null ? null : String(filters.organisationId),
    });
    this.#clock = clock;
  }

  /** The HazardEvent (domain) the report is about. */
  get event() {
    return this.#event;
  }

  get dateFrom() {
    return this.#dateFrom;
  }

  get dateTo() {
    return this.#dateTo;
  }

  /** The selected district ids, as strings, in the order given. */
  get districtIds() {
    return this.#districtIds;
  }

  /** The A1 filters (DMS-156): each null when not set. */
  get filters() {
    return this.#filters;
  }

  get clock() {
    return this.#clock;
  }

  /**
   * Every day of the range, both ends included, in order: the days each
   * section's daily series lists and GapDetector checks.
   * @returns {string[]}
   */
  days() {
    return SriLankaCalendar.daysBetween(this.#dateFrom, this.#dateTo);
  }

  /**
   * The range as instants, for querying records by timestamp: from the start
   * of the first day (included) to the start of the day after the last
   * (excluded), both in Sri Lanka time.
   * @returns {{ start: Date, end: Date }}
   */
  instants() {
    const start = SriLankaCalendar.startOf(this.#dateFrom);
    const end = SriLankaCalendar.startOf(this.#dateTo);
    end.setTime(end.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }

  /**
   * The Sri Lanka day a record's timestamp falls on, or null when it falls
   * outside the range (or isn't a date).
   * @param {Date|string|number} date
   * @returns {string|null}
   */
  dayOf(date) {
    const day = SriLankaCalendar.dayOf(date);
    return day !== null && day >= this.#dateFrom && day <= this.#dateTo ? day : null;
  }

  /**
   * True when the district is one of the selected districts.
   * @param {string|object} districtId an id, or anything that prints as one
   * @returns {boolean}
   */
  includesDistrict(districtId) {
    return districtId != null && this.#districtIds.includes(String(districtId));
  }
}
