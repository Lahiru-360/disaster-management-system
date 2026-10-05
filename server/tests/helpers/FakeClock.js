/**
 * A clock a test controls, in place of src/utils/SystemClock.js: pass it to a
 * service's constructor and time only moves when the test says so.
 *
 * @example
 * const clock = new FakeClock('2026-09-28T08:00:00.000Z');
 * const service = new SomeService({ clock });
 * clock.advance(2 * FakeClock.HOUR); // past UC02's 2-hour cluster window
 */
export class FakeClock {
  static SECOND = 1000;

  static MINUTE = 60 * FakeClock.SECOND;

  static HOUR = 60 * FakeClock.MINUTE;

  static DAY = 24 * FakeClock.HOUR;

  #time;

  /**
   * @param {Date|string|number} [start='2026-09-28T08:00:00.000Z'] The time now() starts at.
   */
  constructor(start = '2026-09-28T08:00:00.000Z') {
    this.set(start);
  }

  /**
   * The fake current time, as a new Date each call (like SystemClock).
   * @returns {Date}
   */
  now() {
    return new Date(this.#time);
  }

  /**
   * Moves time forward; a negative ms moves it back.
   * @param {number} ms
   * @returns {FakeClock} This clock, for chaining.
   */
  advance(ms) {
    this.#time += ms;
    return this;
  }

  /**
   * Jumps to a given time.
   * @param {Date|string|number} time
   * @returns {FakeClock} This clock, for chaining.
   */
  set(time) {
    const ms = new Date(time).getTime();
    if (Number.isNaN(ms)) {
      throw new Error(`FakeClock: "${time}" is not a valid time`);
    }
    this.#time = ms;
    return this;
  }
}
