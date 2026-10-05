import { InAppChannel } from '../../../src/services/notifications/InAppChannel.js';
import { NotificationChannel } from '../../../src/services/notifications/NotificationChannel.js';

describe('NotificationChannel', () => {
  it('DMS-106: the base refuses to send, naming the subclass that forgot to', () => {
    class SilentChannel extends NotificationChannel {}

    expect(() => new SilentChannel().send({})).toThrow('SilentChannel must implement send()');
  });

  it('DMS-106: a subclass is used through the base type (Strategy)', async () => {
    class FailingChannel extends NotificationChannel {
      async send() {
        return { status: 'FAILED', reason: 'network down' };
      }
    }
    const channels = [new InAppChannel(), new FailingChannel()];

    const results = await Promise.all(channels.map((channel) => channel.send({})));

    expect(channels.every((channel) => channel instanceof NotificationChannel)).toBe(true);
    expect(results).toEqual([
      { status: 'DELIVERED' },
      { status: 'FAILED', reason: 'network down' },
    ]);
  });
});

describe('InAppChannel', () => {
  it('DMS-106: an inbox item is delivered as soon as it is stored', async () => {
    await expect(new InAppChannel().send({ title: 'Report confirmed' })).resolves.toEqual({
      status: 'DELIVERED',
    });
  });
});
