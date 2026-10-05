import { NotificationChannel } from '../../src/services/notifications/NotificationChannel.js';

/**
 * A NotificationChannel whose results a test scripts, for the "a channel
 * failed" paths (UC01 E3, UC02 notify, UC04 share). Every send() is recorded.
 *
 * Each call takes the next scripted entry: a result object is resolved, an
 * Error is thrown (as a broken channel would). Once the script runs out, it
 * delivers.
 *
 * @example
 * const sms = new FakeChannel().willReturn([{ status: 'FAILED', reason: 'no signal' }]);
 * const service = new NotificationService({ channels: [sms] });
 * // ... act ...
 * expect(sms.calls).toHaveLength(1);
 */
export class FakeChannel extends NotificationChannel {
  static #DEFAULT_RESULT = Object.freeze({ status: 'DELIVERED' });

  #script = [];

  /** Every notification passed to send(), in order. */
  calls = [];

  /**
   * Queues the results of the next calls, after any still queued.
   * @param {Array<{ status: 'SENT'|'DELIVERED'|'FAILED', reason?: string } | Error>} results
   * @returns {FakeChannel} This channel, for chaining.
   */
  willReturn(results) {
    this.#script.push(...results);
    return this;
  }

  /**
   * Records the notification, then resolves the next scripted result or
   * throws the next scripted Error.
   * @param {object} notification
   * @returns {Promise<{ status: 'SENT'|'DELIVERED'|'FAILED', reason?: string }>}
   */
  async send(notification) {
    this.calls.push(notification);
    const next = this.#script.length > 0 ? this.#script.shift() : FakeChannel.#DEFAULT_RESULT;
    if (next instanceof Error) {
      throw next;
    }
    return { ...next };
  }

  /**
   * Forgets the recorded calls and any results still queued.
   * @returns {FakeChannel} This channel, for chaining.
   */
  reset() {
    this.calls = [];
    this.#script = [];
    return this;
  }
}
