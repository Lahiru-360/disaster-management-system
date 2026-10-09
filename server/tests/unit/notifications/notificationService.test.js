import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { NotificationType } from '../../../src/enums/NotificationType.js';
import { Role } from '../../../src/enums/Role.js';
import { User } from '../../../src/models/User.js';
import { UserNotification } from '../../../src/models/UserNotification.js';
import { NotificationService } from '../../../src/services/NotificationService.js';
import { InAppChannel } from '../../../src/services/notifications/InAppChannel.js';
import { NotificationChannel } from '../../../src/services/notifications/NotificationChannel.js';

const NOW = new Date('2026-10-02T05:01:00.000Z');
const clock = () => NOW;

const payload = () => ({
  type: NotificationType.REPORT_CONFIRMED,
  title: 'Report confirmed',
  body: 'Your report GR-2481 was confirmed by the duty officer. Thank you.',
  link: '/my-reports/66f9a0c1b2c3d4e5f6a7b801',
});

class FailingChannel extends NotificationChannel {
  async send() {
    return { status: 'FAILED', reason: 'gateway down' };
  }
}

class ThrowingChannel extends NotificationChannel {
  async send() {
    throw new Error('socket hang up');
  }
}

class RecordingChannel extends NotificationChannel {
  sent = [];

  async send(notification) {
    this.sent.push(notification);
    return { status: 'SENT' };
  }
}

const colombo = new mongoose.Types.ObjectId();
const gampaha = new mongoose.Types.ObjectId();
let counter = 0;

const createUser = (role, fields = {}) =>
  User.create({
    name: `${role} ${++counter}`,
    email: `user${counter}@example.test`,
    passwordHash: 'not-a-real-hash',
    role,
    ...fields,
  });

const recipientsOf = (items) => items.map((item) => item.user.toString()).sort();
const idsOf = (users) => users.map((user) => user.id).sort();

describe('NotificationService.notifyUser', () => {
  it('DMS-106: stores an unread inbox item for the user', async () => {
    const user = await createUser(Role.CITIZEN);
    const service = new NotificationService({ clock });

    const item = await service.notifyUser(user.id, payload());

    const stored = await UserNotification.findById(item.id);
    expect(stored.user.toString()).toBe(user.id);
    expect(stored).toMatchObject({ ...payload(), readAt: null, severity: null });
  });

  it('DMS-106: hands the stored item to every channel and records each result', async () => {
    const recorder = new RecordingChannel();
    const service = new NotificationService({ channels: [new InAppChannel(), recorder], clock });

    const item = await service.notifyUser(new mongoose.Types.ObjectId(), payload());

    expect(recorder.sent.map((sent) => sent.id)).toEqual([item.id]);
    const stored = await UserNotification.findById(item.id);
    expect(stored.deliveries.map((delivery) => delivery.toObject())).toEqual([
      { channel: 'InAppChannel', status: 'DELIVERED', reason: null, at: NOW },
      { channel: 'RecordingChannel', status: 'SENT', reason: null, at: NOW },
    ]);
  });

  it('DMS-106: records a channel that returns FAILED, and still stores the item', async () => {
    const service = new NotificationService({ channels: [new FailingChannel()], clock });

    const item = await service.notifyUser(new mongoose.Types.ObjectId(), payload());

    const stored = await UserNotification.findById(item.id);
    expect(stored.deliveries[0]).toMatchObject({
      channel: 'FailingChannel',
      status: 'FAILED',
      reason: 'gateway down',
    });
  });

  it('DMS-106: records a channel that throws as FAILED, without failing the caller', async () => {
    const service = new NotificationService({
      channels: [new ThrowingChannel(), new InAppChannel()],
      clock,
    });

    const item = await service.notifyUser(new mongoose.Types.ObjectId(), payload());

    const stored = await UserNotification.findById(item.id);
    expect(
      stored.deliveries.map(({ channel, status, reason }) => ({ channel, status, reason })),
    ).toEqual([
      { channel: 'ThrowingChannel', status: 'FAILED', reason: 'socket hang up' },
      { channel: 'InAppChannel', status: 'DELIVERED', reason: null },
    ]);
  });

  it('DMS-106: an item that cannot be stored is logged and returns null instead of throwing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const service = new NotificationService({ clock });

    const item = await service.notifyUser(new mongoose.Types.ObjectId(), {
      ...payload(),
      type: 'PROMO',
    });

    expect(item).toBeNull();
    expect(await UserNotification.countDocuments()).toBe(0);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('DMS-106: keeps the item when its delivery record cannot be saved', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    class BadStatusChannel extends NotificationChannel {
      async send() {
        return { status: 'LOST' };
      }
    }
    const service = new NotificationService({ channels: [new BadStatusChannel()], clock });

    const item = await service.notifyUser(new mongoose.Types.ObjectId(), payload());

    expect(item).not.toBeNull();
    expect(await UserNotification.countDocuments()).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('DMS-106: stores a hazard alert with its severity', async () => {
    const service = new NotificationService({ clock });

    const item = await service.notifyUser(new mongoose.Types.ObjectId(), {
      type: NotificationType.HAZARD_ALERT,
      title: 'Flood Warning: SEVERE',
      body: 'Flood Warning: SEVERE. Move to higher ground and follow official guidance.',
      severity: 'SEVERE',
    });

    expect(item.severity).toBe('SEVERE');
    expect(item.link).toBeNull();
  });

  it('DMS-106: the shared default instance delivers in-app', async () => {
    const { notificationService } = await import('../../../src/services/NotificationService.js');

    const item = await notificationService.notifyUser(new mongoose.Types.ObjectId(), payload());

    expect(item.deliveries[0]).toMatchObject({ channel: 'InAppChannel', status: 'DELIVERED' });
  });
});

describe('NotificationService.notifyRole', () => {
  it('DMS-106: notifying dmc_officer also reaches every duty_officer (role inheritance)', async () => {
    const officers = [
      await createUser(Role.DMC_OFFICER),
      await createUser(Role.DUTY_OFFICER, { shiftDistrict: colombo }),
    ];
    await createUser(Role.DISTRICT_OFFICER, { district: colombo });
    await createUser(Role.CITIZEN, { homeDistrict: colombo });
    const service = new NotificationService({ clock });

    const items = await service.notifyRole(Role.DMC_OFFICER, {}, payload());

    expect(recipientsOf(items)).toEqual(idsOf(officers));
  });

  it('DMS-106: notifying duty_officer does not reach a plain dmc_officer', async () => {
    const duty = await createUser(Role.DUTY_OFFICER, { shiftDistrict: colombo });
    await createUser(Role.DMC_OFFICER);
    const service = new NotificationService({ clock });

    const items = await service.notifyRole(Role.DUTY_OFFICER, {}, payload());

    expect(recipientsOf(items)).toEqual([duty.id]);
  });

  it('DMS-106: narrows to users whose district field is the district', async () => {
    const onShift = await createUser(Role.DUTY_OFFICER, { shiftDistrict: colombo });
    await createUser(Role.DUTY_OFFICER, { shiftDistrict: gampaha });
    await createUser(Role.DUTY_OFFICER);
    const service = new NotificationService({ clock });

    const items = await service.notifyRole(
      Role.DUTY_OFFICER,
      { districtId: colombo, districtField: 'shiftDistrict' },
      payload(),
    );

    expect(recipientsOf(items)).toEqual([onShift.id]);
  });

  it('DMS-106: citizen reaches community volunteers, by home district', async () => {
    const residents = [
      await createUser(Role.CITIZEN, { homeDistrict: colombo }),
      await createUser(Role.COMMUNITY_VOLUNTEER, { homeDistrict: colombo }),
    ];
    await createUser(Role.CITIZEN, { homeDistrict: gampaha });
    const service = new NotificationService({ clock });

    const items = await service.notifyRole(
      Role.CITIZEN,
      { districtId: colombo.toString(), districtField: 'homeDistrict' },
      payload(),
    );

    expect(recipientsOf(items)).toEqual(idsOf(residents));
  });

  it('DMS-106: skips deactivated accounts', async () => {
    const active = await createUser(Role.DMC_OFFICER);
    await createUser(Role.DMC_OFFICER, { isActive: false });
    const service = new NotificationService({ clock });

    const items = await service.notifyRole(Role.DMC_OFFICER, {}, payload());

    expect(recipientsOf(items)).toEqual([active.id]);
  });

  it('DMS-106: returns an empty list when nobody matches, so the caller can fall back', async () => {
    await createUser(Role.DUTY_OFFICER, { shiftDistrict: gampaha });
    const service = new NotificationService({ clock });

    const items = await service.notifyRole(
      Role.DUTY_OFFICER,
      { districtId: colombo, districtField: 'shiftDistrict' },
      payload(),
    );

    expect(items).toEqual([]);
    expect(await UserNotification.countDocuments()).toBe(0);
  });

  it('DMS-106: leaves out a recipient whose item could not be stored', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await createUser(Role.DMC_OFFICER);
    const service = new NotificationService({ clock });

    const items = await service.notifyRole(Role.DMC_OFFICER, {}, { ...payload(), title: '' });

    expect(items).toEqual([]);
    console.error.mockRestore();
  });

  it('DMS-106: refuses a district field that is not a User district field', async () => {
    const service = new NotificationService({ clock });

    await expect(
      service.notifyRole(
        Role.CITIZEN,
        { districtId: colombo, districtField: 'province' },
        payload(),
      ),
    ).rejects.toThrow('districtField must be one of homeDistrict, district, shiftDistrict');
  });

  it('DMS-106: refuses an unknown role', async () => {
    const service = new NotificationService({ clock });

    await expect(service.notifyRole('admin', {}, payload())).rejects.toThrow(
      'Unknown role "admin"',
    );
  });
});

describe('NotificationService.listForUser', () => {
  const store = (user, minutesAfter, fields = {}) =>
    UserNotification.create({
      user,
      ...payload(),
      title: `Item ${minutesAfter}`,
      createdAt: new Date(NOW.getTime() + minutesAfter * 60000),
      ...fields,
    });

  it('DMS-106: returns the page newest first, with total and unread counts', async () => {
    const owner = new mongoose.Types.ObjectId();
    await store(owner, 1);
    await store(owner, 3, { readAt: NOW });
    await store(owner, 2);
    await store(new mongoose.Types.ObjectId(), 4);
    const service = new NotificationService({ clock });

    const inbox = await service.listForUser(owner, { page: 1, limit: 2 });

    expect(inbox.notifications.map((item) => item.title)).toEqual(['Item 3', 'Item 2']);
    expect(inbox).toMatchObject({ page: 1, limit: 2, total: 3, unreadCount: 2 });
  });

  it('DMS-106: the next page continues where the first stopped, and past the end is empty', async () => {
    const owner = new mongoose.Types.ObjectId();
    for (const minutes of [1, 2, 3]) {
      await store(owner, minutes);
    }
    const service = new NotificationService({ clock });

    const second = await service.listForUser(owner, { page: 2, limit: 2 });
    const past = await service.listForUser(owner, { page: 3, limit: 2 });

    expect(second.notifications.map((item) => item.title)).toEqual(['Item 1']);
    expect(past.notifications).toEqual([]);
    expect(past.total).toBe(3);
  });
});

describe('NotificationService.markRead', () => {
  const later = new Date('2026-10-02T06:00:00.000Z');

  it("DMS-106: sets readAt from the clock on the owner's unread item", async () => {
    const owner = new mongoose.Types.ObjectId();
    const item = await UserNotification.create({ user: owner, ...payload() });
    const service = new NotificationService({ clock });

    const read = await service.markRead(owner, item.id);

    expect(read.readAt).toEqual(NOW);
    expect((await UserNotification.findById(item.id)).readAt).toEqual(NOW);
  });

  it('DMS-106: marking an already read item keeps its first readAt', async () => {
    const owner = new mongoose.Types.ObjectId();
    const item = await UserNotification.create({ user: owner, ...payload(), readAt: NOW });
    const service = new NotificationService({ clock: () => later });

    const read = await service.markRead(owner, item.id);

    expect(read.readAt).toEqual(NOW);
  });

  it.each([
    [
      "someone else's item",
      async () =>
        (await UserNotification.create({ user: new mongoose.Types.ObjectId(), ...payload() })).id,
    ],
    ['an unknown id', async () => new mongoose.Types.ObjectId().toString()],
    ['a malformed id', async () => 'not-an-id'],
  ])('DMS-106: %s is 404 NOT_FOUND', async (_case, idFor) => {
    const service = new NotificationService({ clock });

    await expect(
      service.markRead(new mongoose.Types.ObjectId(), await idFor()),
    ).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it("DMS-106: refusing someone else's item leaves it unread", async () => {
    const item = await UserNotification.create({
      user: new mongoose.Types.ObjectId(),
      ...payload(),
    });
    const service = new NotificationService({ clock });

    await service.markRead(new mongoose.Types.ObjectId(), item.id).catch(() => {});

    expect((await UserNotification.findById(item.id)).readAt).toBeNull();
  });
});
