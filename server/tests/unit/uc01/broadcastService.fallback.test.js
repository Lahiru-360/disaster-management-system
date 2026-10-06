import { FallbackPolicy } from '../../../src/domain/alerts/FallbackPolicy.js';
import { Role } from '../../../src/enums/Role.js';
import { Notification } from '../../../src/models/Notification.js';
import { BroadcastService } from '../../../src/services/BroadcastService.js';
import { WarningService } from '../../../src/services/WarningService.js';
import { AudibleChannel } from '../../../src/services/notifications/AudibleChannel.js';
import { FakeTransport } from '../../../src/services/notifications/FakeTransport.js';
import { PushChannel } from '../../../src/services/notifications/PushChannel.js';
import { SmsChannel } from '../../../src/services/notifications/SmsChannel.js';
import { FakeChannel } from '../../helpers/FakeChannel.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

// UC01 E3 (DMS-128): a failed delivery is resent through the SMS fallback,
// up to 3 attempts in total, inside the recipient × channel loop.
const NOW = '2026-10-02T06:31:00.000Z';
const MESSAGE = 'Flood Warning: SEVERE. Move to higher ground and follow official guidance.';
const FAILED = (reason) => ({ status: 'FAILED', reason });

// A FakeChannel standing in for one of the three channels.
class ScriptedChannel extends FakeChannel {
  #channel;

  constructor(channel) {
    super();
    this.#channel = channel;
  }

  get channel() {
    return this.#channel;
  }
}

const failing = (Channel) => new Channel({ transport: new FakeTransport({ failRate: 1 }) });

describe('BroadcastService SMS fallback (UC01 E3)', () => {
  let clock;
  let areas;
  let officer;
  let warnings;
  let push;
  let sms;
  let audible;

  beforeEach(async () => {
    clock = new FakeClock(NOW);
    areas = await seedAreas();
    officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
    warnings = new WarningService({ clock });
    [push, sms, audible] = ['PUSH', 'SMS', 'AUDIBLE'].map((name) => new ScriptedChannel(name));
  });

  const serviceWith = (options = {}) =>
    new BroadcastService({ clock, warnings, channels: [push, sms, audible], ...options });

  const citizensIn = async (district, count) => {
    const citizens = [];
    for (let i = 0; i < count; i += 1) citizens.push(await createUser({ homeDistrict: district }));
    return citizens;
  };

  const previewedDraft = async () => {
    const { id } = await warnings.startDraft(officer);
    await warnings.preview(id, {
      hazardType: 'FLOOD',
      severity: 'SEVERE',
      areaIds: [areas.colombo.id],
    });
    return String(id);
  };

  const record = (id, channel) => Notification.findOne({ alert: id, channel }).lean();

  // The channels each of the citizen's PUSH delivery's attempts went through.
  const attemptsOf = (notificationChannel) =>
    [push, sms, audible].flatMap((strategy) =>
      strategy.calls
        .filter((call) => call.channel === notificationChannel)
        .map(() => strategy.channel),
    );

  it('E3: TC-39 push fails, SMS succeeds on attempt 2 and the retries stop', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    push.willReturn([FAILED('Push notification was not delivered')]);

    await serviceWith().broadcast(id, officer, MESSAGE);

    expect(await record(id, 'PUSH')).toMatchObject({
      channel: 'PUSH',
      status: 'DELIVERED',
      attempts: 2,
      fallbackChannel: 'SMS',
      deliveredAt: new Date(NOW),
      failureReason: null,
    });
    expect(attemptsOf('PUSH')).toEqual(['PUSH', 'SMS']);
  });

  it('E3: TC-40 fails 3 times: FAILED with attempts 3 and no 4th attempt', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    push.willReturn([FAILED('Push notification was not delivered')]);
    // The citizen's own SMS delivery goes first, then the push's two resends.
    sms.willReturn([
      { status: 'DELIVERED' },
      FAILED('SMS gateway busy'),
      FAILED('SMS gateway did not accept the message'),
      FAILED('never reached'),
    ]);

    await serviceWith().broadcast(id, officer, MESSAGE);

    expect(await record(id, 'PUSH')).toMatchObject({
      status: 'FAILED',
      attempts: 3,
      fallbackChannel: 'SMS',
      failureReason: 'SMS gateway did not accept the message',
    });
    expect(attemptsOf('PUSH')).toEqual(['PUSH', 'SMS', 'SMS']);
  });

  it('E3: a failed SMS delivery is itself retried by SMS up to the same limit', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    sms.willReturn([FAILED('a'), FAILED('b'), FAILED('c'), FAILED('never reached')]);

    await serviceWith().broadcast(id, officer, MESSAGE);

    expect(await record(id, 'SMS')).toMatchObject({
      status: 'FAILED',
      attempts: 3,
      fallbackChannel: 'SMS',
      failureReason: 'c',
    });
    expect(sms.calls).toHaveLength(3);
    expect(await record(id, 'PUSH')).toMatchObject({ status: 'DELIVERED', attempts: 1 });
  });

  it('E3: a failed audible alert is resent by SMS too', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    audible.willReturn([FAILED('siren offline')]);

    await serviceWith().broadcast(id, officer, MESSAGE);

    expect(await record(id, 'AUDIBLE')).toMatchObject({
      status: 'DELIVERED',
      attempts: 2,
      fallbackChannel: 'SMS',
    });
  });

  it('E3: TC-44 an SMS channel that throws during the fallback is a failed attempt, no crash', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    push.willReturn([new Error('push gateway timeout')]);
    sms.willReturn([
      { status: 'DELIVERED' },
      new Error('SMS gateway timeout'),
      new Error('SMS gateway timeout again'),
    ]);

    const { summary } = await serviceWith().broadcast(id, officer, MESSAGE);

    expect(await record(id, 'PUSH')).toMatchObject({
      status: 'FAILED',
      attempts: 3,
      failureReason: 'SMS gateway timeout again',
    });
    expect(summary.totals.failed).toBe(1);
  });

  it('E3: a resend the channel only accepts (SENT) also stops the retries', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    push.willReturn([FAILED('offline')]);
    sms.willReturn([{ status: 'DELIVERED' }, { status: 'SENT' }]);

    await serviceWith().broadcast(id, officer, MESSAGE);

    expect(await record(id, 'PUSH')).toMatchObject({ status: 'SENT', attempts: 2 });
    expect(sms.calls).toHaveLength(2);
  });

  it('E3: a delivery that succeeds first time is never resent', async () => {
    await citizensIn(areas.colombo, 2);
    const id = await previewedDraft();

    await serviceWith().broadcast(id, officer, MESSAGE);

    const records = await Notification.find({ alert: id }).lean();
    expect(records.every((r) => r.attempts === 1 && r.fallbackChannel === null)).toBe(true);
    expect(sms.calls).toHaveLength(2);
  });

  it('E3: follows the injected policy for the limit', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    push.willReturn([FAILED('offline')]);
    sms.willReturn([{ status: 'DELIVERED' }, FAILED('busy'), { status: 'DELIVERED' }]);

    await serviceWith({ fallback: new FallbackPolicy({ maxAttempts: 2 }) }).broadcast(
      id,
      officer,
      MESSAGE,
    );

    expect(await record(id, 'PUSH')).toMatchObject({ status: 'FAILED', attempts: 2 });
  });

  it('E3: without the fallback channel among the channels, nothing is resent', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    push.willReturn([FAILED('offline')]);

    await serviceWith({ channels: [push, audible] }).broadcast(id, officer, MESSAGE);

    expect(await record(id, 'PUSH')).toMatchObject({
      status: 'FAILED',
      attempts: 1,
      fallbackChannel: null,
    });
  });

  it('E3: TC-43 the summary counts the resent alerts and the citizens still unreached', async () => {
    await citizensIn(areas.colombo, 3);
    const id = await previewedDraft();

    const { summary } = await serviceWith({
      channels: [failing(PushChannel), new SmsChannel(), new AudibleChannel()],
    }).broadcast(id, officer, MESSAGE);

    expect(summary).toMatchObject({
      perChannel: [
        { channel: 'PUSH', sent: 3, delivered: 3, failed: 0 },
        { channel: 'SMS', sent: 3, delivered: 3, failed: 0 },
        { channel: 'AUDIBLE', sent: 3, delivered: 3, failed: 0 },
      ],
      fallback: { channel: 'SMS', resent: 3 },
      unreachedCount: 0,
    });
  });

  it('E3: TC-43 every channel down: every delivery resent, FAILED, every citizen unreached', async () => {
    await citizensIn(areas.colombo, 2);
    const id = await previewedDraft();

    const { summary } = await serviceWith({
      channels: [failing(PushChannel), failing(SmsChannel), failing(AudibleChannel)],
    }).broadcast(id, officer, MESSAGE);

    expect(summary).toMatchObject({
      totals: { sent: 6, delivered: 0, failed: 6 },
      fallback: { channel: 'SMS', resent: 6 },
      unreachedCount: 2,
    });
    const records = await Notification.find({ alert: id }).lean();
    expect(records.every((r) => r.attempts === 3 && r.status === 'FAILED')).toBe(true);
  });

  it('E3: an update is resent through the fallback the same way', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    const service = serviceWith();
    await service.broadcast(id, officer, MESSAGE);
    push.willReturn([FAILED('offline')]);

    const { summary } = await service.update(id, officer, {
      severity: 'HIGH',
      message: 'UPDATE: Flood Warning now HIGH.',
    });

    expect(
      await Notification.findOne({ alert: id, alertVersion: 2, channel: 'PUSH' }).lean(),
    ).toMatchObject({ kind: 'UPDATE', status: 'DELIVERED', attempts: 2, fallbackChannel: 'SMS' });
    expect(summary).toMatchObject({ version: 2, fallback: { resent: 1 }, unreachedCount: 0 });
  });
});
