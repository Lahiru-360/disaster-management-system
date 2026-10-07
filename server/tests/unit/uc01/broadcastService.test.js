import mongoose from 'mongoose';
import { Role } from '../../../src/enums/Role.js';
import { District } from '../../../src/models/District.js';
import { HazardAlert } from '../../../src/models/HazardAlert.js';
import { Notification } from '../../../src/models/Notification.js';
import { UserNotification } from '../../../src/models/UserNotification.js';
import { FallbackPolicy } from '../../../src/domain/alerts/FallbackPolicy.js';
import { BroadcastService } from '../../../src/services/BroadcastService.js';
import { NotificationService } from '../../../src/services/NotificationService.js';
import { WarningService } from '../../../src/services/WarningService.js';
import { AlertChannel } from '../../../src/services/notifications/AlertChannel.js';
import { FakeTransport } from '../../../src/services/notifications/FakeTransport.js';
import { PushChannel } from '../../../src/services/notifications/PushChannel.js';
import { SmsChannel } from '../../../src/services/notifications/SmsChannel.js';
import { AudibleChannel } from '../../../src/services/notifications/AudibleChannel.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

const NOW = '2026-10-02T06:31:00.000Z';
const MESSAGE = 'Flood Warning: SEVERE. Move to higher ground and follow official guidance.';

// One attempt per delivery: the DMS-121 tests below look at a channel's own
// result, before the SMS fallback (E3, DMS-128) resends a failure.
const noFallback = new FallbackPolicy({ maxAttempts: 1 });

const channels = (overrides = {}) => [
  overrides.push ?? new PushChannel(),
  overrides.sms ?? new SmsChannel(),
  overrides.audible ?? new AudibleChannel(),
];

describe('BroadcastService', () => {
  let clock;
  let areas;
  let officer;
  let warnings;

  beforeEach(async () => {
    clock = new FakeClock(NOW);
    areas = await seedAreas();
    officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
    warnings = new WarningService({ clock });
  });

  const serviceWith = (options = {}) => new BroadcastService({ clock, ...options });

  // A previewed draft for Colombo (or the given areas), ready to broadcast.
  const previewedDraft = async (areaDocs = [areas.colombo]) => {
    const { id } = await warnings.startDraft(officer);
    await warnings.preview(id, {
      hazardType: 'FLOOD',
      severity: 'SEVERE',
      areaIds: areaDocs.map((doc) => doc.id),
    });
    return id;
  };

  const citizensIn = async (district, count) => {
    const citizens = [];
    for (let i = 0; i < count; i += 1) citizens.push(await createUser({ homeDistrict: district }));
    return citizens;
  };

  it('Main 12: TC-09 sets BROADCAST with the issuing officer, the time and a history entry', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();

    const { alert } = await serviceWith().broadcast(id, officer, MESSAGE);

    expect(alert).toMatchObject({
      status: 'BROADCAST',
      version: 1,
      message: MESSAGE,
      issuedBy: { id: officer.id, name: officer.name },
      issuedAt: new Date(NOW),
    });
    expect(alert.statusHistory.map((entry) => entry.status)).toEqual(['DRAFT', 'BROADCAST']);
  });

  it('Main 13: TC-10 creates one delivery per recipient and channel, all DELIVERED', async () => {
    const citizens = [
      ...(await citizensIn(areas.colombo, 2)),
      ...(await citizensIn(areas.gampaha, 1)),
    ];
    await citizensIn(areas.kalutara, 1);
    const id = await previewedDraft([areas.colombo, areas.kelani]);

    await serviceWith().broadcast(id, officer, MESSAGE);

    const records = await Notification.find({ alert: id }).lean();
    expect(records).toHaveLength(citizens.length * 3);
    for (const citizen of citizens) {
      expect(
        records
          .filter((record) => record.citizen.toString() === citizen.id)
          .map((record) => record.channel)
          .sort(),
      ).toEqual(['AUDIBLE', 'PUSH', 'SMS']);
    }
    expect(records.every((record) => record.status === 'DELIVERED')).toBe(true);
    expect(records[0]).toMatchObject({
      kind: 'WARNING',
      alertVersion: 1,
      attempts: 1,
      sentAt: new Date(NOW),
      deliveredAt: new Date(NOW),
      failureReason: null,
    });
  });

  it('Main 14: returns the delivery summary of what it just sent', async () => {
    await citizensIn(areas.colombo, 2);
    const id = await previewedDraft();

    const { summary } = await serviceWith({
      channels: channels({
        push: new PushChannel({ transport: new FakeTransport({ failRate: 1 }) }),
      }),
      fallback: noFallback,
    }).broadcast(id, officer, MESSAGE);

    expect(summary).toMatchObject({
      version: 1,
      perChannel: [
        { channel: 'PUSH', sent: 2, delivered: 0, failed: 2 },
        { channel: 'SMS', sent: 2, delivered: 2, failed: 0 },
        { channel: 'AUDIBLE', sent: 2, delivered: 2, failed: 0 },
      ],
      totals: { sent: 6, delivered: 4, failed: 2 },
      unreachedCount: 0,
    });
  });

  it("Main 14: deliverySummary reads the alert and its current version's counts", async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    const draftSummary = await serviceWith().deliverySummary(id);
    await serviceWith().broadcast(id, officer, MESSAGE);

    const { alert, summary } = await serviceWith().deliverySummary(id);

    expect(draftSummary.summary.totals).toEqual({ sent: 0, delivered: 0, failed: 0 });
    expect(draftSummary.alert.status).toBe('DRAFT');
    expect(alert).toMatchObject({ id, status: 'BROADCAST' });
    expect(summary.totals).toEqual({ sent: 3, delivered: 3, failed: 0 });
    await expect(serviceWith().deliverySummary('nope')).rejects.toMatchObject({ status: 404 });
  });

  it("Main 12: the officer's final message replaces the draft's", async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();

    const { alert } = await serviceWith().broadcast(id, officer, '  Move to higher ground now.  ');

    expect(alert.message).toBe('Move to higher ground now.');
  });

  it('Main 13: TC-13 a channel that throws is FAILED and the others still deliver', async () => {
    class BrokenAudible extends AlertChannel {
      static channel = 'AUDIBLE';

      async send() {
        throw new Error('siren gateway timeout');
      }
    }
    await citizensIn(areas.colombo, 2);
    const id = await previewedDraft();

    await serviceWith({
      channels: channels({ audible: new BrokenAudible() }),
      fallback: noFallback,
    }).broadcast(id, officer, MESSAGE);

    const byChannel = async (channel) => Notification.find({ alert: id, channel }).lean();
    expect((await byChannel('AUDIBLE')).map((r) => [r.status, r.failureReason])).toEqual([
      ['FAILED', 'siren gateway timeout'],
      ['FAILED', 'siren gateway timeout'],
    ]);
    expect((await byChannel('PUSH')).every((r) => r.status === 'DELIVERED')).toBe(true);
    expect((await byChannel('SMS')).every((r) => r.status === 'DELIVERED')).toBe(true);
  });

  it('Main 13: a channel that reports FAILED or SENT is recorded as such', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    class AcceptedSms extends AlertChannel {
      static channel = 'SMS';

      async send() {
        return { status: 'SENT' };
      }
    }

    await serviceWith({
      channels: channels({
        push: new PushChannel({ transport: new FakeTransport({ failRate: 1 }) }),
        sms: new AcceptedSms(),
      }),
      fallback: noFallback,
    }).broadcast(id, officer, MESSAGE);

    const status = async (channel) =>
      Notification.findOne({ alert: id, channel })
        .lean()
        .then((r) => [r.status, r.failureReason]);
    expect(await status('PUSH')).toEqual(['FAILED', 'Push notification was not delivered']);
    expect(await status('SMS')).toEqual(['SENT', null]);
    expect(await status('AUDIBLE')).toEqual(['DELIVERED', null]);
  });

  it('Main 13: TC-14 a fourth channel is added by injection alone (Open/Closed)', async () => {
    await citizensIn(areas.colombo, 2);
    const id = await previewedDraft();
    class PagerChannel extends AlertChannel {
      static channel = 'PAGER';
    }
    // The stored enum knows three channels, so this proves the service with
    // an in-memory record store instead.
    const stored = [];
    const notificationModel = {
      insertMany: async (docs) => stored.push(...docs),
      bulkWrite: async () => {},
    };

    await serviceWith({
      channels: [...channels(), new PagerChannel()],
      notificationModel,
    }).broadcast(id, officer, MESSAGE);

    expect(stored).toHaveLength(2 * 4);
    expect([...new Set(stored.map((doc) => doc.channel))].sort()).toEqual([
      'AUDIBLE',
      'PAGER',
      'PUSH',
      'SMS',
    ]);
  });

  it('Main 13: writes the deliveries in batches', async () => {
    await citizensIn(areas.colombo, 3);
    const id = await previewedDraft();
    const batches = [];
    const notificationModel = {
      insertMany: async (docs) => batches.push(docs.length),
      bulkWrite: async () => {},
    };
    const original = BroadcastService.BATCH_SIZE;
    BroadcastService.BATCH_SIZE = 4;
    try {
      await serviceWith({ notificationModel }).broadcast(id, officer, MESSAGE);
    } finally {
      BroadcastService.BATCH_SIZE = original;
    }

    expect(batches).toEqual([4, 4, 1]);
  });

  it("Main 13: puts a HAZARD_ALERT with the severity in every recipient's inbox", async () => {
    const citizens = await citizensIn(areas.colombo, 2);
    const id = await previewedDraft();

    await serviceWith().broadcast(id, officer, MESSAGE);

    const items = await UserNotification.find().lean();
    expect(items.map((item) => item.user.toString()).sort()).toEqual(
      citizens.map((c) => c.id).sort(),
    );
    expect(items[0]).toMatchObject({
      type: 'HAZARD_ALERT',
      title: 'Flood Warning: SEVERE',
      body: MESSAGE,
      severity: 'SEVERE',
    });
  });

  it('Main 13: an inbox that fails never fails the broadcast', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    const notifications = new NotificationService({
      userNotificationModel: { create: async () => Promise.reject(new Error('down')) },
    });
    const errorSpy = (await import('@jest/globals')).jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(
      serviceWith({ notifications }).broadcast(id, officer, MESSAGE),
    ).resolves.toMatchObject({ alert: { status: 'BROADCAST' } });
    errorSpy.mockRestore();
  });

  it('Main 12: TC-12 broadcasting a BROADCAST alert is 409 and sends nothing more', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    await serviceWith().broadcast(id, officer, MESSAGE);

    await expect(serviceWith().broadcast(id, officer, MESSAGE)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_ALERT_TRANSITION',
      message: 'Only a DRAFT alert can be broadcast – current status: BROADCAST',
    });
    expect(await Notification.countDocuments({ alert: id })).toBe(3);
  });

  it('Main 12: two officers broadcasting the same draft at once: one wins, one 409', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    const colleague = await createUser({ role: Role.DMC_OFFICER });

    const results = await Promise.allSettled([
      serviceWith().broadcast(id, officer, MESSAGE),
      serviceWith().broadcast(id, colleague, MESSAGE),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(results.find((r) => r.status === 'rejected').reason).toMatchObject({ status: 409 });
    expect(await Notification.countDocuments({ alert: id })).toBe(3);
  });

  it('Main 12: a draft that was never previewed is 409 and sends nothing', async () => {
    const { id } = await warnings.startDraft(officer);

    await expect(serviceWith().broadcast(id, officer, MESSAGE)).rejects.toMatchObject({
      status: 409,
      message: 'Preview the warning before broadcasting it',
    });
    expect((await HazardAlert.findById(id)).status).toBe('DRAFT');
    expect(await Notification.countDocuments()).toBe(0);
  });

  it('Main 12: a scope area that has gone since the preview is 400, and nothing is sent', async () => {
    await citizensIn(areas.gampaha, 1);
    const id = await previewedDraft([areas.gampaha]);
    await District.deleteOne({ _id: areas.gampaha._id });

    await expect(serviceWith().broadcast(id, officer, MESSAGE)).rejects.toMatchObject({
      status: 400,
      errors: [{ field: 'areaIds', message: `unknown area ids: ${areas.gampaha.id}` }],
    });
    expect((await HazardAlert.findById(id)).status).toBe('DRAFT');
    expect(await Notification.countDocuments()).toBe(0);
  });

  it.each([
    ['an unknown id', () => new mongoose.Types.ObjectId().toString()],
    ['a malformed id', () => 'nope'],
  ])('Main 12: %s is 404 NOT_FOUND', async (_case, idFor) => {
    await expect(serviceWith().broadcast(idFor(), officer, MESSAGE)).rejects.toMatchObject({
      status: 404,
      message: 'Hazard alert not found.',
    });
  });

  it('Main 13: the shared default instance broadcasts on the three configured channels', async () => {
    await citizensIn(areas.colombo, 1);
    const id = await previewedDraft();
    const { broadcastService } = await import('../../../src/services/BroadcastService.js');

    await broadcastService.broadcast(id, officer, MESSAGE);

    expect(await Notification.countDocuments({ alert: id })).toBe(3);
  });
});
