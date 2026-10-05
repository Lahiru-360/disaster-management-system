// Abstract base for the ways a notification can be delivered (Strategy, UC01
// class diagram). NotificationService holds a list of channels and calls send()
// on each without knowing which it is, so a new channel needs no change to the
// service. send() resolves to { status: 'SENT' | 'DELIVERED' | 'FAILED', reason? };
// a channel may also throw, and the service records that as FAILED.
export class NotificationChannel {
  /**
   * Delivers one notification.
   * @param {object} _notification the stored notification to deliver
   * @returns {Promise<{ status: 'SENT' | 'DELIVERED' | 'FAILED', reason?: string }>}
   */
  send(_notification) {
    throw new Error(`${this.constructor.name} must implement send()`);
  }
}
