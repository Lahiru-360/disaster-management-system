import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardAlert } from '../../src/models/HazardAlert.js';
import { Notification } from '../../src/models/Notification.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { bearerFor, expiredBearerFor } from '../helpers/authHelper.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { createUser } from '../helpers/userFactory.js';

// UC01 main flow steps 9-14 through the HTTP API (contract §12.6-12.7). The
// channel failure and added-channel cases (TC-13, TC-14) need injected
// channels, so they are in tests/unit/uc01/broadcastService.test.js.
let areas;
let duty;
let citizens;

beforeEach(async () => {
  areas = await seedAreas();
  duty = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
  citizens = [];
  for (const homeDistrict of [areas.colombo, areas.colombo, areas.gampaha, areas.kalutara]) {
    citizens.push(await createUser({ homeDistrict }));
  }
});

const as = (user) => ({ Authorization: bearerFor(user) });

const MESSAGE = 'Flood Warning: SEVERE. Move to higher ground and follow official guidance.';

// A draft previewed for Colombo and Gampaha: three of the four citizens.
const previewedDraft = async () => {
  const start = await request(app).post('/api/hazard-alerts').set(as(duty)).send({});
  const { id } = start.body.data.alert;
  await request(app)
    .post(`/api/hazard-alerts/${id}/preview`)
    .set(as(duty))
    .send({
      hazardType: 'FLOOD',
      severity: 'SEVERE',
      areaIds: [areas.colombo.id, areas.gampaha.id],
    });
  return id;
};

const broadcast = (id, body = { message: MESSAGE }, user = duty) =>
  request(app).post(`/api/hazard-alerts/${id}/broadcast`).set(as(user)).send(body);

const deliverySummary = (id, user = duty) =>
  request(app).get(`/api/hazard-alerts/${id}/delivery-summary`).set(as(user));

describe('POST /api/hazard-alerts/:id/broadcast', () => {
  it('DMS-121: TC-09 sets BROADCAST with the issuing officer, the time and a history entry', async () => {
    const id = await previewedDraft();

    const res = await broadcast(id);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alert).toMatchObject({
      id,
      status: 'BROADCAST',
      version: 1,
      message: MESSAGE,
      issuedBy: { id: duty.id, name: duty.name },
      issuedAt: expect.any(String),
    });
    expect(res.body.data.alert.statusHistory.at(-1)).toEqual({
      status: 'BROADCAST',
      version: 1,
      at: res.body.data.alert.issuedAt,
      by: { id: duty.id, name: duty.name },
    });
  });

  it('DMS-121: TC-10 creates one delivery per recipient and channel and returns their summary', async () => {
    const id = await previewedDraft();

    const res = await broadcast(id);

    const recipients = citizens.slice(0, 3).map((citizen) => citizen.id);
    const deliveries = await Notification.find({ alert: id }).lean();
    expect(deliveries).toHaveLength(recipients.length * 3);
    for (const citizen of recipients) {
      const channels = deliveries
        .filter((delivery) => String(delivery.citizen) === citizen)
        .map((delivery) => delivery.channel);
      expect(channels.sort()).toEqual(['AUDIBLE', 'PUSH', 'SMS']);
    }
    expect(deliveries.every((delivery) => delivery.kind === 'WARNING')).toBe(true);
    expect(deliveries.every((delivery) => delivery.alertVersion === 1)).toBe(true);
    expect(deliveries.every((delivery) => delivery.attempts === 1 && delivery.sentAt)).toBe(true);
    expect(res.body.data.summary).toEqual({
      version: 1,
      perChannel: ['PUSH', 'SMS', 'AUDIBLE'].map((channel) => ({
        channel,
        sent: 3,
        delivered: 3,
        failed: 0,
      })),
      totals: { sent: 9, delivered: 9, failed: 0 },
      fallback: { channel: 'SMS', resent: 0 },
      unreachedCount: 0,
    });
  });

  it("DMS-121: puts the warning in each recipient's inbox, and no one else's", async () => {
    const id = await previewedDraft();

    await broadcast(id);

    const items = await UserNotification.find().lean();
    expect(items.map((item) => String(item.user)).sort()).toEqual(
      citizens
        .slice(0, 3)
        .map((citizen) => citizen.id)
        .sort(),
    );
    expect(items[0]).toMatchObject({ type: 'HAZARD_ALERT', body: MESSAGE, severity: 'SEVERE' });
  });

  it('DMS-121: TC-12 broadcasting it again is 409 INVALID_ALERT_TRANSITION and sends nothing more', async () => {
    const id = await previewedDraft();
    await broadcast(id);

    const res = await broadcast(id);

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_ALERT_TRANSITION',
      message: 'Only a DRAFT alert can be broadcast – current status: BROADCAST',
    });
    expect(await Notification.countDocuments()).toBe(9);
    expect(await UserNotification.countDocuments()).toBe(3);
  });

  it('DMS-121: a draft that was never previewed is 409 and sends nothing', async () => {
    const start = await request(app).post('/api/hazard-alerts').set(as(duty)).send({});
    const { id } = start.body.data.alert;

    const res = await broadcast(id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_ALERT_TRANSITION');
    expect((await HazardAlert.findById(id)).status).toBe('DRAFT');
    expect(await Notification.countDocuments()).toBe(0);
  });

  it.each([
    ['missing', {}],
    ['empty', { message: '   ' }],
    ['161 characters', { message: 'x'.repeat(161) }],
  ])('DMS-121: a message %s is 400 VALIDATION_ERROR on message', async (_case, body) => {
    const id = await previewedDraft();

    const res = await broadcast(id, body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([{ field: 'message', message: expect.any(String) }]);
    expect((await HazardAlert.findById(id)).status).toBe('DRAFT');
  });

  it.each([Role.DISTRICT_OFFICER, Role.CITIZEN])(
    'DMS-121: a %s is 403 FORBIDDEN, and nothing is sent',
    async (role) => {
      const id = await previewedDraft();

      const res = await broadcast(id, { message: MESSAGE }, await createUser({ role }));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(await Notification.countDocuments()).toBe(0);
    },
  );

  it('DMS-121: no token is 401 and an expired one is 401 TOKEN_EXPIRED', async () => {
    const id = await previewedDraft();

    const missing = await request(app)
      .post(`/api/hazard-alerts/${id}/broadcast`)
      .send({ message: MESSAGE });
    const expired = await request(app)
      .post(`/api/hazard-alerts/${id}/broadcast`)
      .set('Authorization', expiredBearerFor(duty))
      .send({ message: MESSAGE });

    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('AUTH_HEADER_MISSING');
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('GET /api/hazard-alerts/:id/delivery-summary', () => {
  it('DMS-121: TC-11 the per-channel counts match the stored delivery records', async () => {
    const id = await previewedDraft();
    await broadcast(id);
    // Two push and one SMS delivery failed, as E3 would leave them.
    const failed = await Notification.find({ alert: id, channel: 'PUSH' }).limit(2);
    const failedSms = await Notification.findOne({ alert: id, channel: 'SMS' });
    await Notification.updateMany(
      { _id: { $in: [...failed, failedSms].map((doc) => doc._id) } },
      { $set: { status: 'FAILED', failureReason: 'gateway timeout' } },
    );

    const res = await deliverySummary(id);

    expect(res.status).toBe(200);
    expect(res.body.data.alert).toMatchObject({ id, status: 'BROADCAST' });
    expect(res.body.data.summary.perChannel).toEqual([
      { channel: 'PUSH', sent: 3, delivered: 1, failed: 2 },
      { channel: 'SMS', sent: 3, delivered: 2, failed: 1 },
      { channel: 'AUDIBLE', sent: 3, delivered: 3, failed: 0 },
    ]);
    expect(res.body.data.summary.totals).toEqual({ sent: 9, delivered: 6, failed: 3 });
  });

  it('DMS-121: a DRAFT has sent nothing, so every count is zero', async () => {
    const id = await previewedDraft();

    const res = await deliverySummary(id);

    expect(res.status).toBe(200);
    expect(res.body.data.alert).toMatchObject({ id, status: 'DRAFT' });
    expect(res.body.data.summary.totals).toEqual({ sent: 0, delivered: 0, failed: 0 });
    expect(res.body.data.summary.unreachedCount).toBe(0);
  });

  it('DMS-121: a district officer cannot read it', async () => {
    const id = await previewedDraft();

    const res = await deliverySummary(id, await createUser({ role: Role.DISTRICT_OFFICER }));

    expect(res.status).toBe(403);
  });
});

it.each([
  ['an unknown id', () => new mongoose.Types.ObjectId().toString()],
  ['a malformed id', () => 'not-an-id'],
])('DMS-121: %s is 404 NOT_FOUND on broadcast and delivery summary', async (_case, idFor) => {
  const id = idFor();

  const responses = await Promise.all([broadcast(id), deliverySummary(id)]);

  for (const res of responses) {
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Hazard alert not found.' });
  }
  expect(await Notification.countDocuments()).toBe(0);
});
