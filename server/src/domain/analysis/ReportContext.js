import { SriLankaCalendar } from '../../utils/SriLankaCalendar.js';
import { systemClock } from '../../utils/SystemClock.js';

// What every ReportSection compiles against: the closed event, the inclusive
// range of Sri Lanka calendar days, the selected districts, the A1 filters and
// the clock. Built once per report, so all four sections see the same
// selection, and read-only, so no section can change it for the next.
//
// A1 (DMS-156): a district filter narrows districtIds to that one district for
// every section; the other filters are read by the sections that honour them,
// each given its own copy through withFilters().
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
   * @param {string[]} params.districtIds the report's selection, at least one
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
    if (
      this.#filters.districtId !== null &&
      !this.#districtIds.includes(this.#filters.districtId)
    ) {
      throw new Error('ReportContext districtId filter must be one of the selected districts');
    }
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

  /**
   * The district ids the sections cover, as strings: the selection in the
   * order given, or only the filtered district when a district filter is set.
   */
  get districtIds() {
    return this.#filters.districtId === null
      ? this.#districtIds
      : Object.freeze([this.#filters.districtId]);
  }

  /** The report's own district selection, whatever the district filter. */
  get selectedDistrictIds() {
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
   * The same selection with only the named filters kept, the rest null: what
   * a section that honours just those filters compiles against.
   * @param {string[]} keys e.g. ['districtId', 'hazardType']
   * @returns {ReportContext}
   */
  withFilters(keys) {
    return new ReportContext({
      event: this.#event,
      dateFrom: this.#dateFrom,
      dateTo: this.#dateTo,
      districtIds: [...this.#districtIds],
      filters: Object.fromEntries(keys.map((key) => [key, this.#filters[key] ?? null])),
      clock: this.#clock,
    });
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
   * True when the district is one the sections cover (districtIds).
   * @param {string|object} districtId an id, or anything that prints as one
   * @returns {boolean}
   */
  includesDistrict(districtId) {
    return districtId != null && this.districtIds.includes(String(districtId));
  }
}
