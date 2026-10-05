import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { env } from '../../src/config/Config.js';
import { app } from '../../src/core/App.js';
import { NotificationType } from '../../src/enums/NotificationType.js';
import { Role } from '../../src/enums/Role.js';
import { User } from '../../src/models/User.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { notificationService } from '../../src/services/NotificationService.js';

// Every role has an inbox, so tests sign in as whichever they need; the
// account is created directly, as for any seeded role.
let counter = 0;
const createUser = (role = Role.CITIZEN) =>
  User.create({
    name: `Test ${role}`,
    email: `${role}${++counter}@notifications.test`,
    passwordHash: 'unused',
    role,
  });

const bearerFor = (user, expiresIn = '15m') =>
  `Bearer ${jwt.sign({ id: user.id, role: user.role }, env.jwtAccessSecret, { expiresIn })}`;

const BASE = new Date('2026-10-02T05:00:00.000Z');

// Stored with explicit, increasing createdAt values so the order is known.
const storeFor = (user, minutesAfter, fields = {}) =>
  UserNotification.create({
    user: user._id,
    type: NotificationType.REPORT_CONFIRMED,
    title: `Item ${minutesAfter}`,
    body: 'Your report GR-2481 was confirmed by the duty officer. Thank you.',
    createdAt: new Date(BASE.getTime() + minutesAfter * 60000),
    ...fields,
  });

const listInbox = (user, query = {}) =>
  request(app).get('/api/notifications/me').query(query).set('Authorization', bearerFor(user));

const markRead = (user, id) =>
  request(app).patch(`/api/notifications/${id}/read`).set('Authorization', bearerFor(user));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/notifications/me', () => {
  it("DMS-106: returns the caller's items newest first, in the §11.1 shape", async () => {
    const user = await createUser();
    await storeFor(user, 1);
    await storeFor(user, 2, {
      type: NotificationType.HAZARD_ALERT,
      title: 'Flood Warning: SEVERE',
      severity: 'SEVERE',
    });

    const res = await listInbox(user);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ page: 1, limit: 20, total: 2, unreadCount: 2 });
    const [newest, older] = res.body.data.notifications;
    expect(newest).toMatchObject({
      type: 'HAZARD_ALERT',
      title: 'Flood Warning: SEVERE',
      severity: 'SEVERE',
      readAt: null,
      link: null,
    });
    expect(older.title).toBe('Item 1');
    expect(Object.keys(newest).sort()).toEqual(
      ['body', 'createdAt', 'id', 'link', 'readAt', 'severity', 'title', 'type'].sort(),
    );
  });

  it("DMS-106: never includes another user's items", async () => {
    const user = await createUser();
    const other = await createUser();
    await storeFor(other, 1);

    const res = await listInbox(user);

    expect(res.body.data).toMatchObject({ notifications: [], total: 0, unreadCount: 0 });
  });

  it('DMS-106: pages in order without overlap, and counts unread across every page', async () => {
    const user = await createUser(Role.DUTY_OFFICER);
    for (const minutes of [1, 2, 3, 4, 5]) {
      await storeFor(user, minutes, minutes === 5 ? { readAt: BASE } : {});
    }

    const first = await listInbox(user, { page: 1, limit: 2 });
    const second = await listInbox(user, { page: 2, limit: 2 });
    const third = await listInbox(user, { page: 3, limit: 2 });

    const titles = (res) => res.body.data.notifications.map((item) => item.title);
    expect(titles(first)).toEqual(['Item 5', 'Item 4']);
    expect(titles(second)).toEqual(['Item 3', 'Item 2']);
    expect(titles(third)).toEqual(['Item 1']);
    expect(second.body.data).toMatchObject({ page: 2, limit: 2, total: 5, unreadCount: 4 });
  });

  it('DMS-106: items stored in the same instant keep a stable order across pages', async () => {
    const user = await createUser();
    for (let i = 0; i < 4; i += 1) {
      await storeFor(user, 0, { title: `Tie ${i}` });
    }

    const first = await listInbox(user, { page: 1, limit: 2 });
    const second = await listInbox(user, { page: 2, limit: 2 });

    const ids = [...first.body.data.notifications, ...second.body.data.notifications].map(
      (item) => item.id,
    );
    expect(new Set(ids).size).toBe(4);
  });

  it('DMS-106: a page past the end is 200 with an empty list', async () => {
    const user = await createUser();
    await storeFor(user, 1);

    const res = await listInbox(user, { page: 9 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ notifications: [], page: 9, total: 1 });
  });

  it('DMS-106: accepts the largest limit', async () => {
    const res = await listInbox(await createUser(), { limit: 50 });

    expect(res.status).toBe(200);
    expect(res.body.data.limit).toBe(50);
  });

  it.each([
    [{ limit: 51 }, 'limit'],
    [{ limit: 0 }, 'limit'],
    [{ page: 0 }, 'page'],
    [{ page: 'two' }, 'page'],
    [{ limit: 2.5 }, 'limit'],
  ])('DMS-106: refuses %o with 400 VALIDATION_ERROR on %s', async (query, field) => {
    const res = await listInbox(await createUser(), query);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors.map((error) => error.field)).toEqual([field]);
  });

  it('DMS-106: requires a token', async () => {
    const res = await request(app).get('/api/notifications/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_HEADER_MISSING');
  });

  it('DMS-106: refuses an expired token', async () => {
    const res = await request(app)
      .get('/api/notifications/me')
      .set('Authorization', bearerFor(await createUser(), '-1s'));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('DMS-106: shows what NotificationService sent, end to end', async () => {
    const officer = await createUser(Role.DUTY_OFFICER);

    await notificationService.notifyRole(
      Role.DMC_OFFICER,
      {},
      {
        type: NotificationType.REPORT_SUBMITTED,
        title: 'New ground report',
        body: 'New ground report GR-2481 – Rising river / Flood – Kolonnawa',
        link: '/hazard-reports/66f9a0c1b2c3d4e5f6a7b801',
      },
    );
    const res = await listInbox(officer);

    expect(res.body.data.notifications).toEqual([
      expect.objectContaining({
        type: 'REPORT_SUBMITTED',
        link: '/hazard-reports/66f9a0c1b2c3d4e5f6a7b801',
        readAt: null,
      }),
    ]);
    expect(res.body.data.notifications[0]).not.toHaveProperty('deliveries');
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it("DMS-106: marks the caller's item read and returns it", async () => {
    const user = await createUser();
    const item = await storeFor(user, 1);

    const res = await markRead(user, item.id);

    expect(res.status).toBe(200);
    expect(res.body.data.notification).toMatchObject({ id: item.id, title: 'Item 1' });
    expect(new Date(res.body.data.notification.readAt).getTime()).not.toBeNaN();
    const inbox = await listInbox(user);
    expect(inbox.body.data.unreadCount).toBe(0);
  });

  it('DMS-106: marking it again is 200 and keeps the first readAt', async () => {
    const user = await createUser();
    const item = await storeFor(user, 1, { readAt: BASE });

    const res = await markRead(user, item.id);

    expect(res.status).toBe(200);
    expect(res.body.data.notification.readAt).toBe(BASE.toISOString());
  });

  it("DMS-106: another user's item is 404, and stays unread", async () => {
    const owner = await createUser();
    const item = await storeFor(owner, 1);

    const res = await markRead(await createUser(Role.DMC_OFFICER), item.id);

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Notification not found.' });
    expect((await UserNotification.findById(item.id)).readAt).toBeNull();
  });

  it.each([
    ['an unknown id', () => new mongoose.Types.ObjectId().toString()],
    ['a malformed id', () => 'not-an-id'],
  ])('DMS-106: %s is 404 NOT_FOUND', async (_case, idFor) => {
    const res = await markRead(await createUser(), idFor());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('DMS-106: requires a token', async () => {
    const res = await request(app).patch(
      `/api/notifications/${new mongoose.Types.ObjectId()}/read`,
    );

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_HEADER_MISSING');
  });

  it('DMS-106: a database failure is 500 INTERNAL_ERROR', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const user = await createUser();
    jest.spyOn(UserNotification, 'findOneAndUpdate').mockRejectedValue(new Error('db down'));

    const res = await markRead(user, new mongoose.Types.ObjectId());

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
