import { env } from '../../config/Config.js';
import { Channel } from '../../enums/Channel.js';
import { AlertChannel } from './AlertChannel.js';
import { FakeTransport } from './FakeTransport.js';

// An SMS to the citizen's phone number, and the fallback channel for failed
// deliveries (E3). Fails the share of sends set by Config's demoFailSmsRate
// (0 by default).
export class SmsChannel extends AlertChannel {
  static channel = Channel.SMS;

  static failureReason = 'SMS gateway did not accept the message';

  constructor({ transport = new FakeTransport({ failRate: env.demoFailSmsRate }) } = {}) {
    super({ transport });
  }
}
