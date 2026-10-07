import { DeliveryStatus } from '../../enums/DeliveryStatus.js';

// The id, as a string, of something given as a document, a plain { id }, an
// ObjectId or a string.
const idOf = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value.toHexString === 'function') {
    return String(value);
  }
  return idOf(value.id ?? value._id);
};

// One delivery of a hazard warning to one citizen on one channel (UC01 class
// diagram). It holds the delivery state machine: QUEUED → SENT → DELIVERED or
// FAILED, where a channel may also report DELIVERED or FAILED straight from
// QUEUED. DELIVERED and FAILED are final. A failed send is resent through the
// fallback channel (E3) before it is recorded: resendVia() counts the attempt
// while the delivery is still QUEUED, and only the last attempt's result is
// marked. It never saves itself - BroadcastService does that with
// deliveryChanges().
//
// Times are passed in rather than read here, so the service's injected clock
// decides them and tests can fix them.
export class Notification {
  static #FINAL = [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED];

  #id;
  #alertId;
  #alertVersion;
  #kind;
  #citizenId;
  #channel;
  #status;
  #attempts;
  #fallbackChannel;
  #sentAt;
  #deliveredAt;
  #failureReason;

  /**
   * @param {object} fields The stored record's fields; `alert` and `citizen`
   *   may be documents or ids.
   */
  constructor({
    id,
    alert,
    alertVersion,
    kind,
    citizen,
    channel,
    status = DeliveryStatus.QUEUED,
    attempts = 1,
    fallbackChannel = null,
    sentAt = null,
    deliveredAt = null,
    failureReason = null,
  } = {}) {
    if (!Object.values(DeliveryStatus).includes(status)) {
      throw new Error(`Notification: unknown status "${status}"`);
    }
    this.#id = idOf(id);
    this.#alertId = idOf(alert);
    this.#alertVersion = alertVersion;
    this.#kind = kind;
    this.#citizenId = idOf(citizen);
    this.#channel = channel;
    this.#status = status;
    this.#attempts = attempts;
    this.#fallbackChannel = fallbackChannel;
    this.#sentAt = sentAt;
    this.#deliveredAt = deliveredAt;
    this.#failureReason = failureReason;
  }

  /** A Notification for a stored record (a document or a plain object). */
  static fromDocument(doc) {
    const fields = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return new Notification({ ...fields, id: fields._id ?? fields.id });
  }

  /**
   * The channel accepted it but hasn't confirmed delivery.
   * @param {Date} at
   */
  markSent(at) {
    this.#leaveQueue(DeliveryStatus.SENT, at);
  }

  /**
   * The channel confirmed delivery.
   * @param {Date} at
   */
  markDelivered(at) {
    this.#leaveQueue(DeliveryStatus.DELIVERED, at);
    this.#deliveredAt = at;
  }

  /**
   * The channel failed, or threw.
   * @param {string} reason
   * @param {Date} at
   */
  markFailed(reason, at) {
    this.#leaveQueue(DeliveryStatus.FAILED, at);
    this.#failureReason = reason ?? 'Delivery failed';
  }

  /**
   * E3.2: one more attempt, through the fallback channel, after a failed send.
   * The caller (BroadcastService, under FallbackPolicy) decides whether it is
   * allowed; this only refuses a delivery that already has a final result.
   * @param {string} channel The fallback channel, e.g. "SMS".
   */
  resendVia(channel) {
    if (this.#status !== DeliveryStatus.QUEUED) {
      throw new Error(`Notification: cannot resend a ${this.#status} delivery`);
    }
    this.#attempts += 1;
    this.#fallbackChannel = channel;
  }

  /** True once nothing more will happen to this delivery. */
  isFinal() {
    return Notification.#FINAL.includes(this.#status);
  }

  // sentAt is when it left the queue, so it is kept from the first change.
  #leaveQueue(status, at) {
    if (
      this.isFinal() ||
      (this.#status === DeliveryStatus.SENT && status === DeliveryStatus.SENT)
    ) {
      throw new Error(`Notification: cannot go from ${this.#status} to ${status}`);
    }
    this.#status = status;
    this.#sentAt ??= at;
  }

  get id() {
    return this.#id;
  }

  get alertId() {
    return this.#alertId;
  }

  get alertVersion() {
    return this.#alertVersion;
  }

  get kind() {
    return this.#kind;
  }

  get citizenId() {
    return this.#citizenId;
  }

  get channel() {
    return this.#channel;
  }

  get status() {
    return this.#status;
  }

  get attempts() {
    return this.#attempts;
  }

  /** The channel it was resent through (E3), or null if it never was. */
  get fallbackChannel() {
    return this.#fallbackChannel;
  }

  get sentAt() {
    return this.#sentAt;
  }

  get deliveredAt() {
    return this.#deliveredAt;
  }

  get failureReason() {
    return this.#failureReason;
  }

  /** The fields a delivery changes, for the service to save. */
  deliveryChanges() {
    return {
      status: this.#status,
      attempts: this.#attempts,
      fallbackChannel: this.#fallbackChannel,
      sentAt: this.#sentAt,
      deliveredAt: this.#deliveredAt,
      failureReason: this.#failureReason,
    };
  }
}
