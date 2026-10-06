import { NotificationChannel } from './NotificationChannel.js';
import { FakeTransport } from './FakeTransport.js';

// Base for the three ways a hazard warning reaches a citizen (UC01 class
// diagram: PushChannel, SmsChannel, AudibleChannel). Each subclass names its
// Channel value and how a failure reads; sending goes through a transport,
// a FakeTransport by default since real gateways are mocked.
export class AlertChannel extends NotificationChannel {
  // The Channel value this strategy delivers on; set by every subclass.
  static channel = undefined;

  // The reason recorded on a delivery this channel failed.
  static failureReason = 'Delivery failed';

  #transport;

  /** @param {{ transport?: { deliver(message: object): Promise<boolean> } }} [options] */
  constructor({ transport = new FakeTransport() } = {}) {
    super();
    if (new.target === AlertChannel) {
      throw new Error('AlertChannel is abstract - construct one of its channel subclasses instead');
    }
    this.#transport = transport;
  }

  /** The Channel value, e.g. "PUSH": which delivery records this strategy fills. */
  get channel() {
    return this.constructor.channel;
  }

  /**
   * Hands one delivery to the transport.
   * @param {import('../../domain/alerts/Notification.js').Notification} notification
   * @returns {Promise<{ status: 'DELIVERED' | 'FAILED', reason?: string }>}
   */
  async send(notification) {
    const accepted = await this.#transport.deliver({
      channel: this.channel,
      alertId: notification.alertId,
      alertVersion: notification.alertVersion,
      citizenId: notification.citizenId,
    });
    return accepted
      ? { status: 'DELIVERED' }
      : { status: 'FAILED', reason: this.constructor.failureReason };
  }
}
