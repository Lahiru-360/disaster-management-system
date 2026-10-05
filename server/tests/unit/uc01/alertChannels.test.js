import { Notification } from '../../../src/domain/alerts/Notification.js';
import { AlertChannel } from '../../../src/services/notifications/AlertChannel.js';
import { AudibleChannel } from '../../../src/services/notifications/AudibleChannel.js';
import { FakeTransport } from '../../../src/services/notifications/FakeTransport.js';
import { NotificationChannel } from '../../../src/services/notifications/NotificationChannel.js';
import { PushChannel } from '../../../src/services/notifications/PushChannel.js';
import { SmsChannel } from '../../../src/services/notifications/SmsChannel.js';

const delivery = (channel) =>
  new Notification({ alert: 'a1', alertVersion: 2, kind: 'WARNING', citizen: 'c1', channel });

// A random source that returns the given values in turn.
const sequence =
  (...values) =>
  () =>
    values.shift();

describe('FakeTransport', () => {
  it('DMS-121: accepts and records every message by default', async () => {
    const transport = new FakeTransport();

    await expect(transport.deliver({ to: 'c1' })).resolves.toBe(true);
    expect(transport.sent).toEqual([{ to: 'c1' }]);
  });

  it('DMS-121: fails the configured share of sends, recording only the accepted ones', async () => {
    const transport = new FakeTransport({ failRate: 0.5, random: sequence(0.2, 0.7, 0.49, 0.5) });

    const results = [];
    for (const to of ['a', 'b', 'c', 'd']) {
      results.push(await transport.deliver({ to }));
    }

    expect(results).toEqual([false, true, false, true]);
    expect(transport.sent.map((message) => message.to)).toEqual(['b', 'd']);
  });

  it('DMS-121: a rate of 1 fails everything and 0 nothing', async () => {
    await expect(new FakeTransport({ failRate: 1, random: () => 0.999 }).deliver({})).resolves.toBe(
      false,
    );
    await expect(new FakeTransport({ failRate: 0, random: () => 0 }).deliver({})).resolves.toBe(
      true,
    );
  });
});

describe.each([
  [PushChannel, 'PUSH', 'Push notification was not delivered'],
  [SmsChannel, 'SMS', 'SMS gateway did not accept the message'],
  [AudibleChannel, 'AUDIBLE', 'Audible alert was not delivered'],
])('%p', (ChannelClass, channel, failureReason) => {
  it(`DMS-121: is a NotificationChannel strategy for ${channel}`, () => {
    const strategy = new ChannelClass();

    expect(strategy).toBeInstanceOf(NotificationChannel);
    expect(strategy.channel).toBe(channel);
    expect(strategy.name).toBe(ChannelClass.name);
  });

  it(`DMS-121: a ${channel} send the transport accepts is DELIVERED and recorded`, async () => {
    const transport = new FakeTransport();
    const strategy = new ChannelClass({ transport });

    await expect(strategy.send(delivery(channel))).resolves.toEqual({ status: 'DELIVERED' });
    expect(transport.sent).toEqual([{ channel, alertId: 'a1', alertVersion: 2, citizenId: 'c1' }]);
  });

  it(`DMS-121: a ${channel} send the transport refuses is FAILED with its reason`, async () => {
    const strategy = new ChannelClass({ transport: new FakeTransport({ failRate: 1 }) });

    await expect(strategy.send(delivery(channel))).resolves.toEqual({
      status: 'FAILED',
      reason: failureReason,
    });
  });

  it(`DMS-121: by default the ${channel} channel never fails (rate 0 when unset)`, async () => {
    await expect(new ChannelClass().send(delivery(channel))).resolves.toEqual({
      status: 'DELIVERED',
    });
  });
});

describe('AlertChannel', () => {
  it('DMS-121: is abstract', () => {
    expect(() => new AlertChannel()).toThrow('AlertChannel is abstract');
  });

  it('DMS-121: a channel with no failure reason of its own uses the generic one', async () => {
    class PagerChannel extends AlertChannel {
      static channel = 'PAGER';
    }

    await expect(
      new PagerChannel({ transport: new FakeTransport({ failRate: 1 }) }).send(delivery('PAGER')),
    ).resolves.toEqual({ status: 'FAILED', reason: 'Delivery failed' });
  });
});
