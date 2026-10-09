import { SriLankaCalendar } from '../../utils/SriLankaCalendar.js';

// A run of days in one report section with no records at all (UC04 step 10).
// The days stay in the report, flagged as incomplete data, rather than being
// left out. from and to are inclusive Sri Lanka calendar days, "YYYY-MM-DD".
export class DataGap {
  #section;
  #from;
  #to;
  #reason;

  constructor({ section, from, to, reason } = {}) {
    if (typeof section !== 'string' || section.trim() === '') {
      throw new Error(`DataGap needs a report section key, got ${section}`);
    }
    if (!SriLankaCalendar.isDay(from) || !SriLankaCalendar.isDay(to)) {
      throw new Error('DataGap needs from and to as YYYY-MM-DD days');
    }
    if (from > to) {
      throw new Error('DataGap from must not be after to');
    }
    if (typeof reason !== 'string' || reason.trim() === '') {
      throw new Error('DataGap needs a reason');
    }
    this.#section = section;
    this.#from = from;
    this.#to = to;
    this.#reason = reason.trim();
  }

  get section() {
    return this.#section;
  }

  get from() {
    return this.#from;
  }

  get to() {
    return this.#to;
  }

  get reason() {
    return this.#reason;
  }

  /** The gap as stored on a report and returned by the contract (§14.2). */
  toJSON() {
    return { section: this.#section, from: this.#from, to: this.#to, reason: this.#reason };
  }
}
