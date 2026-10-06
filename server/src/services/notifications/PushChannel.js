import { env } from '../../config/Config.js';
import { Channel } from '../../enums/Channel.js';
import { AlertChannel } from './AlertChannel.js';
import { FakeTransport } from './FakeTransport.js';

// A push notification to the citizen's phone. Fails the share of sends set by
// Config's demoFailPushRate (0 by default).
export class PushChannel extends AlertChannel {
  static channel = Channel.PUSH;

  static failureReason = 'Push notification was not delivered';

  constructor({ transport = new FakeTransport({ failRate: env.demoFailPushRate }) } = {}) {
    super({ transport });
  }
}
