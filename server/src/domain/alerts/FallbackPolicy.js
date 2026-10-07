import { Channel } from '../../enums/Channel.js';

// UC01 E3: how a failed delivery is resent. Every failed delivery, on any
// channel, is resent through the fallback channel (SMS) until one attempt
// isn't a failure or it has had MAX_ATTEMPTS in total, the first send
// included (the class diagram's "SMS fallback allows up to 3 attempts").
// The limit and the channel are defined here only; BroadcastService is given
// a policy, and DeliverySummary reports its channel.
export class FallbackPolicy {
  static MAX_ATTEMPTS = 3;

  static CHANNEL = Channel.SMS;

  #maxAttempts;
  #channel;

  /**
   * @param {{ maxAttempts?: number, channel?: string }} [options] Defaults to
   *   3 attempts through SMS.
   */
  constructor({
    maxAttempts = FallbackPolicy.MAX_ATTEMPTS,
    channel = FallbackPolicy.CHANNEL,
  } = {}) {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      throw new Error(`FallbackPolicy: maxAttempts must be a positive integer, got ${maxAttempts}`);
    }
    if (!Object.values(Channel).includes(channel)) {
      throw new Error(`FallbackPolicy: unknown channel "${channel}"`);
    }
    this.#maxAttempts = maxAttempts;
    this.#channel = channel;
  }

  /** The channel failed deliveries are resent through. */
  get channel() {
    return this.#channel;
  }

  /** The most attempts a delivery gets, the first send included. */
  get maxAttempts() {
    return this.#maxAttempts;
  }

  /**
   * True when a delivery that has failed after this many attempts is resent.
   * @param {number} attempts The attempts it has had so far.
   */
  allowsResend(attempts) {
    return attempts < this.#maxAttempts;
  }
}

export const fallbackPolicy = new FallbackPolicy();
