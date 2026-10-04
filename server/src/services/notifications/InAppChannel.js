import { NotificationChannel } from './NotificationChannel.js';

// The default channel: the inbox itself. The item is already stored by the
// time a channel is asked to send it, and the owner reads it from there, so it
// is delivered by definition.
export class InAppChannel extends NotificationChannel {
  /**
   * Delivers a notification to its owner's inbox.
   * @returns {Promise<{ status: 'DELIVERED' }>}
   */
  async send(_notification) {
    return { status: 'DELIVERED' };
  }
}
