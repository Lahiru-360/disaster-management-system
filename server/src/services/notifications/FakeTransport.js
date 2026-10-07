// A stand-in for a real push, SMS or audible-alert gateway, which the project
// mocks (assignment FAQ). It records every message it accepts and fails the
// configured share of sends, so a demo can show delivery failures (UC01 E3).
// The random source is injected, so a test decides which sends fail.
export class FakeTransport {
  #failRate;
  #random;

  /** Every message accepted, in order. */
  sent = [];

  /**
   * @param {{ failRate?: number, random?: () => number }} [options] failRate is
   *   the share of sends that fail, 0-1.
   */
  constructor({ failRate = 0, random = Math.random } = {}) {
    this.#failRate = failRate;
    this.#random = random;
  }

  /**
   * Accepts a message, or refuses it as if the gateway failed.
   * @param {object} message
   * @returns {Promise<boolean>} true when accepted.
   */
  async deliver(message) {
    if (this.#random() < this.#failRate) {
      return false;
    }
    this.sent.push(message);
    return true;
  }
}
