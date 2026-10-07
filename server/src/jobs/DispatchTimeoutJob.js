import { dispatchService as defaultDispatchService } from '../services/DispatchService.js';

// UC03 E4 (contract §13.10): every 30 seconds, finds the ASSIGNED dispatches
// whose acknowledgement deadline has passed and has the DispatchService mark
// them UNRESPONSIVE - the team UNAVAILABLE, the officer told to reassign. Reads
// and actions check the same thing lazily for the part they touch, so this only
// keeps the rest right between requests. The service owns the clock, so a test
// moves time on with a FakeClock and calls `tick()` instead of waiting.
//
// Started by Server, never by the app itself, so tests don't leave a timer behind.
export class DispatchTimeoutJob {
  static INTERVAL_MS = 30 * 1000;

  #dispatchService;
  #intervalMs;
  #timer = null;
  #running = false;

  constructor({
    dispatchService = defaultDispatchService,
    intervalMs = DispatchTimeoutJob.INTERVAL_MS,
  } = {}) {
    this.#dispatchService = dispatchService;
    this.#intervalMs = intervalMs;
  }

  /** Whether the timer is running. */
  get started() {
    return this.#timer !== null;
  }

  /**
   * Starts checking every interval. Calling it again while started does nothing.
   * The timer never keeps the process alive on its own.
   */
  start() {
    if (this.#timer) return;
    this.#timer = setInterval(() => this.tick(), this.#intervalMs);
    this.#timer.unref?.();
  }

  /** Stops checking; for graceful shutdown. Safe to call when not started. */
  stop() {
    if (!this.#timer) return;
    clearInterval(this.#timer);
    this.#timer = null;
  }

  /**
   * One check. A check still running (a slow database) is not started a second
   * time, and a failure is logged and left for the next tick - the job never
   * throws, since nothing awaits the timer.
   * @returns {Promise<number>} How many dispatches this check marked UNRESPONSIVE.
   */
  async tick() {
    if (this.#running) return 0;
    this.#running = true;
    try {
      return await this.#dispatchService.markOverdueUnresponsive();
    } catch (error) {
      console.error('Dispatch timeout check failed:', error.message);
      return 0;
    } finally {
      this.#running = false;
    }
  }
}

export const dispatchTimeoutJob = new DispatchTimeoutJob();
