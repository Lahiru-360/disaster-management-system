import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { Notification } from '../../src/models/Notification.js';
import { User } from '../../src/models/User.js';
import { bearerFor } from '../helpers/authHelper.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { createUser } from '../helpers/userFactory.js';

// UC01 A3, issue an all-clear for an active warning (contract §12.11 and
// §12.15, catalogue TC-26…TC-29), through the real app.
let areas;
let duty;

beforeEach(async () => {
  areas = await seedAreas();
  duty = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
});

const as = (user) => ({ Authorization: bearerFor(user) });

const ALL_CLEAR =
  'ALL CLEAR: The Flood warning has ended. It is now safe, but follow official guidance.';

const citizensIn = async (district, count) => {
  const citizens = [];
  for (let i = 0; i < count; i += 1) citizens.push(await createUser({ homeDistrict: district }));
  return citizens;
};

const startDraft = async () => {
  const res = await request(app).post('/api/hazard-alerts').set(as(duty)).send({});
  return res.body.data.alert.id;
};

const preview = (id, scope, { hazardType = 'FLOOD', severity = 'SEVERE' } = {}) =>
  request(app)
    .post(`/api/hazard-alerts/${id}/preview`)
    .set(as(duty))
    .send({ hazardType, severity, areaIds: scope.map((area) => area.id) });

const broadcast = (id) =>
  request(app)
    .post(`/api/hazard-alerts/${id}/broadcast`)
    .set(as(duty))
    .send({ message: 'Flood Warning: SEVERE. Move to higher ground.' });

const activeWarning = async (scope, options) => {
  const id = await startDraft();
  await preview(id, scope, options);
  const res = await broadcast(id);
  expect(res.status).toBe(200);
  return res.body.data.alert;
};

const allClear = (id, user = duty) =>
  request(app).post(`/api/hazard-alerts/${id}/all-clear`).set(as(user)).send({});

const listActive = (user = duty) =>
  request(app).get('/api/hazard-alerts').query({ status: 'active' }).set(as(user));

describe('UC01 A3: GET /api/hazard-alerts?status=active', () => {
  it('DMS-124: lists the active warnings with how many citizens the all-clear will reach', async () => {
    await citizensIn(areas.colombo, 2);
    await citizensIn(areas.gampaha, 1);
    const active = await activeWarning([areas.colombo, areas.gampaha]);
    const ended = await activeWarning([areas.colombo], { hazardType: 'CYCLONE' });
    await allClear(ended.id);
    await preview(await startDraft(), [areas.colombo], { hazardType: 'DROUGHT' });

    const res = await listActive();

    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toHaveLength(1);
    expect(res.body.data.alerts[0]).toMatchObject({
      id: active.id,
      referenceNo: active.referenceNo,
      hazardType: 'FLOOD',
      severity: 'SEVERE',
      status: 'BROADCAST',
      version: 1,
      issuedBy: { id: duty.id },
      originalRecipientCount: 3,
    });
  });

  it('DMS-124: nothing active is 200 with []', async () => {
    const res = await listActive();

    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toEqual([]);
  });

  it('DMS-124: a citizen is 403 FORBIDDEN', async () => {
    const res = await listActive(await createUser({ homeDistrict: areas.colombo }));

    expect(res.status).toBe(403);
  });
});

describe('UC01 A3: POST /api/hazard-alerts/:id/all-clear', () => {
  it('DMS-124: TC-26 sets CANCELLED and sends the all-clear, resuming at the delivery summary', async () => {
    await citizensIn(areas.colombo, 2);
    const active = await activeWarning([areas.colombo]);

    const res = await allClear(active.id);

    expect(res.status).toBe(200);
    expect(res.body.data.alert).toMatchObject({
      id: active.id,
      status: 'CANCELLED',
      version: 2,
      message: ALL_CLEAR,
    });
    expect(res.body.data.alert.statusHistory.at(-1)).toMatchObject({
      status: 'CANCELLED',
      version: 2,
      by: { id: duty.id },
    });
    expect(res.body.data.summary).toMatchObject({ version: 2, totals: { sent: 6 } });
    expect(await Notification.countDocuments({ alert: active.id, kind: 'ALL_CLEAR' })).toBe(6);
  });

  it('DMS-124: TC-27 a citizen who changed district after the broadcast still receives it', async () => {
    const [moved] = await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);
    await User.updateOne({ _id: moved._id }, { homeDistrict: areas.kalutara._id });

    await allClear(active.id);

    const records = await Notification.find({ alert: active.id, kind: 'ALL_CLEAR' }).lean();
    expect(records).toHaveLength(3);
    expect(new Set(records.map((record) => record.citizen.toString()))).toEqual(
      new Set([moved.id]),
    );
  });

  it.each([
    ['DRAFT', async () => startDraft()],
    [
      'CANCELLED',
      async () => {
        const active = await activeWarning([areas.colombo]);
        await allClear(active.id);
        return active.id;
      },
    ],
  ])('DMS-124: TC-28 an all-clear on a %s alert is 409 and sends nothing', async (status, make) => {
    await citizensIn(areas.colombo, 1);
    const id = await make();
    const before = await Notification.countDocuments({ alert: id });

    const res = await allClear(id);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'INVALID_ALERT_TRANSITION',
      message: `Only an active alert can be cancelled – current status: ${status}`,
    });
    expect(await Notification.countDocuments({ alert: id })).toBe(before);
  });

  it('DMS-124: TC-29 a CANCELLED alert no longer counts as active: a new warning in the same scope is allowed', async () => {
    await citizensIn(areas.colombo, 1);
    const ended = await activeWarning([areas.colombo]);
    await allClear(ended.id);
    const draft = await startDraft();

    const previewed = await preview(draft, [areas.colombo]);
    const res = await broadcast(draft);

    expect(previewed.body.data.activeWarning).toBeNull();
    expect(res.status).toBe(200);
    expect(res.body.data.alert.status).toBe('BROADCAST');
  });

  it('DMS-124: a CANCELLED alert can no longer be updated', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);
    await allClear(active.id);

    const res = await request(app)
      .patch(`/api/hazard-alerts/${active.id}`)
      .set(as(duty))
      .send({ severity: 'LOW', message: 'UPDATE: now LOW.' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      'Only an active alert can be updated – current status: CANCELLED',
    );
  });

  it('DMS-124: anything in the body is ignored', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);

    const res = await request(app)
      .post(`/api/hazard-alerts/${active.id}/all-clear`)
      .set(as(duty))
      .send({ message: 'something else' });

    expect(res.status).toBe(200);
    expect(res.body.data.alert.message).toBe(ALL_CLEAR);
  });

  it('DMS-124: an unknown alert is 404, a citizen is 403, and no token is 401', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);
    const citizen = await createUser({ homeDistrict: areas.colombo });

    const missing = await allClear(new mongoose.Types.ObjectId().toString());
    const forbidden = await allClear(active.id, citizen);
    const anonymous = await request(app).post(`/api/hazard-alerts/${active.id}/all-clear`);

    expect(missing.status).toBe(404);
    expect(forbidden.status).toBe(403);
    expect(anonymous.status).toBe(401);
  });
});
