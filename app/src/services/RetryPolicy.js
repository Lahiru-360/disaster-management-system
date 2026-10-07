// UC02 E2: when sending a saved report fails for a reason that may pass
// (no connection, a timeout, a 5xx), it is tried again after a growing wait -
// 30 s, 1 min, 2 min, 5 min, then every 10 min - so a weak connection isn't
// hammered and the report still arrives without the reporter doing anything.
// The clock is passed in so the schedule can be checked without waiting.
export class RetryPolicy {
  static DELAYS_MS = Object.freeze([30_000, 60_000, 120_000, 300_000]);

  static STEADY_DELAY_MS = 600_000;

  #now;

  /** @param {{ now?: () => Date }} [options] */
  constructor({ now = () => new Date() } = {}) {
    this.#now = now;
  }

  /**
   * How long to wait after the given number of failed attempts.
   * @param {number} failedAttempts 1 after the first failure.
   * @returns {number} milliseconds
   */
  delayAfter(failedAttempts) {
    const index = Math.max(1, failedAttempts) - 1;
    return RetryPolicy.DELAYS_MS[index] ?? RetryPolicy.STEADY_DELAY_MS;
  }

  /**
   * When the next try is due, after a failure now.
   * @param {number} failedAttempts
   * @returns {string} ISO 8601 time
   */
  nextAttemptAt(failedAttempts) {
    return new Date(this.#now().getTime() + this.delayAfter(failedAttempts)).toISOString();
  }

  /**
   * Whether an item whose next try is due at `nextAttemptAt` may be sent now.
   * An item with no due time (never failed) is always due.
   * @param {string|null|undefined} nextAttemptAt
   * @returns {boolean}
   */
  isDue(nextAttemptAt) {
    return !nextAttemptAt || new Date(nextAttemptAt).getTime() <= this.#now().getTime();
  }

  /**
   * Whether a failed send may pass if tried again: no response at all
   * (offline, a dropped connection, a timeout) or a 5xx. A 4xx such as a
   * 400 validation error would fail the same way again.
   * @param {{ response?: { status: number } }} error
   * @returns {boolean}
   */
  isRetryable(error) {
    const status = error?.response?.status;
    return status === undefined || status >= 500;
  }
}
