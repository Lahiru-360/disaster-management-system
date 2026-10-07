import { env } from '../../config/Config.js';
import { Channel } from '../../enums/Channel.js';
import { AlertChannel } from './AlertChannel.js';
import { FakeTransport } from './FakeTransport.js';

// An audible alert (siren) on the citizen's phone. Fails the share of sends set by
// Config's demoFailAudibleRate (0 by default).
export class AudibleChannel extends AlertChannel {
  static channel = Channel.AUDIBLE;

  static failureReason = 'Audible alert was not delivered';

  constructor({ transport = new FakeTransport({ failRate: env.demoFailAudibleRate }) } = {}) {
    super({ transport });
  }
}
