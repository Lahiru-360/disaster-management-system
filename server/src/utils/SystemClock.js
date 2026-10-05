// The one place the server reads the wall clock. A service that needs the
// time takes `clock = systemClock` in its constructor and calls clock.now(),
// so a test can pass tests/helpers/FakeClock.js instead and move time on
// (UC02's 2-hour cluster window, UC03's 5-minute acknowledgement deadline).
export class SystemClock {
  /**
   * The current time, as a new Date each call so a caller can't change
   * anyone else's.
   * @returns {Date}
   */
  now() {
    return new Date();
  }
}

export const systemClock = new SystemClock();
