// Calendar days as an officer in Sri Lanka counts them. Sri Lanka keeps one
// fixed offset all year (UTC+5:30, no daylight saving), so a day is worked out
// by shifting the instant rather than through a time-zone database.
export class SriLankaCalendar {
  static #OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

  /**
   * The Sri Lanka calendar day an instant falls on, as "YYYY-MM-DD", or null
   * for a missing or invalid date. Days compare correctly as strings.
   * @param {Date|string|number|null|undefined} date
   * @returns {string|null}
   */
  static dayOf(date) {
    if (date === null || date === undefined) {
      return null;
    }
    const time = new Date(date).getTime();
    if (Number.isNaN(time)) {
      return null;
    }
    return new Date(time + SriLankaCalendar.#OFFSET_MS).toISOString().slice(0, 10);
  }

  /**
   * True when the value is a real calendar day written as "YYYY-MM-DD", the
   * form dayOf returns. "2026-02-30" and "2026-6-8" are not.
   * @param {unknown} value
   * @returns {boolean}
   */
  static isDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const time = Date.parse(`${value}T00:00:00.000Z`);
    return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
  }

  /**
   * The instant a Sri Lanka calendar day starts: its midnight in Sri Lanka,
   * which is 18:30 UTC the day before.
   * @param {string} day "YYYY-MM-DD"
   * @returns {Date}
   */
  static startOf(day) {
    SriLankaCalendar.#assertDay(day);
    return new Date(Date.parse(`${day}T00:00:00.000Z`) - SriLankaCalendar.#OFFSET_MS);
  }

  /**
   * Every day from `from` to `to`, both included, in order. Empty when `from`
   * is after `to`.
   * @param {string} from "YYYY-MM-DD"
   * @param {string} to "YYYY-MM-DD"
   * @returns {string[]}
   */
  static daysBetween(from, to) {
    SriLankaCalendar.#assertDay(from);
    SriLankaCalendar.#assertDay(to);
    const days = [];
    for (let time = Date.parse(from); time <= Date.parse(to); time += 24 * 60 * 60 * 1000) {
      days.push(new Date(time).toISOString().slice(0, 10));
    }
    return days;
  }

  static #assertDay(day) {
    if (!SriLankaCalendar.isDay(day)) {
      throw new Error(`Not a calendar day as YYYY-MM-DD: ${day}`);
    }
  }
}
