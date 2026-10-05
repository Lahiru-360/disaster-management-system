import { Counter } from '../models/Counter.js';

// Hands out hazard report reference numbers: GR- plus a number padded to four
// digits (GR-0001, ..., GR-2481, ..., GR-10000). Each number comes from one
// atomic findOneAndUpdate with $inc and upsert on a Counter document, so it is
// unique even when reports are submitted at the same moment, and the counter
// creates itself on first use.
export class ReferenceNumberGenerator {
  #counterModel;
  #counterName;
  #prefix;
  #digits;

  /**
   * @param {object} [options]
   * @param {typeof Counter} [options.counterModel=Counter]
   * @param {string} [options.counterName='hazardReport'] The Counter document to use.
   * @param {string} [options.prefix='GR'] Printed before the dash.
   * @param {number} [options.digits=4] The minimum width; longer numbers aren't cut.
   */
  constructor({
    counterModel = Counter,
    counterName = 'hazardReport',
    prefix = 'GR',
    digits = 4,
  } = {}) {
    this.#counterModel = counterModel;
    this.#counterName = counterName;
    this.#prefix = prefix;
    this.#digits = digits;
  }

  /**
   * Takes the next number from the counter.
   * @returns {Promise<string>} e.g. "GR-2482".
   */
  async next() {
    const counter = await this.#counterModel.findOneAndUpdate(
      { name: this.#counterName },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    return this.format(counter.seq);
  }

  /**
   * Moves the counter on to at least `seq`, so numbers already in use (e.g.
   * seeded reports) are never handed out again. Never moves it back.
   * @param {number} seq The highest number already in use.
   * @returns {Promise<void>}
   */
  async reserveUpTo(seq) {
    await this.#counterModel.findOneAndUpdate(
      { name: this.#counterName },
      { $max: { seq } },
      { upsert: true },
    );
  }

  /**
   * @param {number} seq
   * @returns {string} The reference number for seq, e.g. format(7) → "GR-0007".
   */
  format(seq) {
    return `${this.#prefix}-${String(seq).padStart(this.#digits, '0')}`;
  }
}

export const referenceNumberGenerator = new ReferenceNumberGenerator();
