import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { Notification } from '../../src/models/Notification.js';
import { bearerFor } from '../helpers/authHelper.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { createUser } from '../helpers/userFactory.js';

// UC01 E3.3 through the HTTP API (contract §12.16): the citizens no channel
// reached. The app's fake transports never fail here (no DEMO_FAIL_* rates),
// so a test turns the deliveries it needs into failures after the broadcast;
// the resend itself is covered in tests/unit/uc01/broadcastService.fallback.test.js.
let areas;
let duty;
let citizens;

beforeEach(async () => {
  areas = await seedAreas();
  duty = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
  citizens = [
    await createUser({
      name: 'Chamari Jayasena',
      homeDistrict: areas.colombo,
      phone: '+94771234567',
    }),
    await createUser({ name: 'Amal Perera', homeDistrict: areas.colombo }),
    await createUser({ name: 'Bimal Silva', homeDistrict: areas.colombo }),
  ];
});

const as = (user) => ({ Authorization: bearerFor(user) });

const MESSAGE = 'Flood Warning: SEVERE. Move to higher ground and follow official guidance.';

const startDraft = async () => {
  const start = await request(app).post('/api/hazard-alerts').set(as(duty)).send({});
  return start.body.data.alert.id;
};

// A Colombo warning broadcast to all three citizens.
const broadcastWarning = async () => {
  const id = await startDraft();
  await request(app)
    .post(`/api/hazard-alerts/${id}/preview`)
    .set(as(duty))
    .send({ hazardType: 'FLOOD', severity: 'SEVERE', areaIds: [areas.colombo.id] });
  await request(app)
    .post(`/api/hazard-alerts/${id}/broadcast`)
    .set(as(duty))
    .send({ message: MESSAGE });
  return id;
};

// Every delivery to the citizen on the channels ended FAILED after 3 attempts.
const failFor = (alertId, citizen, channels = ['PUSH', 'SMS', 'AUDIBLE']) =>
  Notification.updateMany(
    { alert: alertId, citizen: citizen._id, channel: { $in: channels } },
    {
      status: 'FAILED',
      attempts: 3,
      fallbackChannel: 'SMS',
      deliveredAt: null,
      failureReason: 'SMS gateway did not accept the message',
    },
  );

const unreached = (id, query = {}, user = duty) =>
  request(app).get(`/api/hazard-alerts/${id}/unreached`).query(query).set(as(user));

describe('GET /api/hazard-alerts/:id/unreached', () => {
  it('DMS-128: TC-42 lists the distinct citizens no channel reached, with district and phone', async () => {
    const id = await broadcastWarning();
    const [chamari, amal, bimal] = citizens;
    await failFor(id, chamari);
    await failFor(id, amal);
    await failFor(id, bimal, ['PUSH', 'SMS']);

    const res = await unreached(id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        version: 1,
        citizens: [
          {
            id: amal.id,
            name: 'Amal Perera',
            district: { id: areas.colombo.id, name: 'Colombo' },
            phone: null,
          },
          {
            id: chamari.id,
            name: 'Chamari Jayasena',
            district: { id: areas.colombo.id, name: 'Colombo' },
            phone: '+94771234567',
          },
        ],
        page: 1,
        limit: 20,
        total: 2,
      },
    });
  });

  it('DMS-128: TC-43 the delivery summary shows the same partial delivery', async () => {
    const id = await broadcastWarning();
    await failFor(id, citizens[0]);

    const summary = await request(app)
      .get(`/api/hazard-alerts/${id}/delivery-summary`)
      .set(as(duty));
    const list = await unreached(id);

    expect(summary.body.data.summary).toMatchObject({
      fallback: { channel: 'SMS', resent: 3 },
      unreachedCount: 1,
    });
    expect(list.body.data.total).toBe(1);
  });

  it('DMS-128: pages with page and limit', async () => {
    const id = await broadcastWarning();
    for (const citizen of citizens) await failFor(id, citizen);

    const res = await unreached(id, { page: '2', limit: '2' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 2, limit: 2, total: 3 });
    expect(res.body.data.citizens.map((c) => c.name)).toEqual(['Chamari Jayasena']);
  });

  it('DMS-128: everyone reached, or a DRAFT that sent nothing, is an empty list', async () => {
    const id = await broadcastWarning();
    const draftId = await startDraft();

    for (const alertId of [id, draftId]) {
      const res = await unreached(alertId);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ citizens: [], total: 0 });
    }
  });

  it.each([
    [{ limit: '51' }, 'limit', 'must be less than or equal to 50'],
    [{ limit: '0' }, 'limit', 'must be greater than or equal to 1'],
    [{ page: '0' }, 'page', 'must be greater than or equal to 1'],
    [{ page: 'two' }, 'page', 'must be a number'],
  ])('DMS-128: refuses query %p with 400 VALIDATION_ERROR', async (query, field, message) => {
    const id = await broadcastWarning();

    const res = await unreached(id, query);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [{ field, message }],
    });
  });

  it('DMS-128: an unknown or malformed id is 404 NOT_FOUND', async () => {
    for (const id of [new mongoose.Types.ObjectId().toString(), 'nope']) {
      const res = await unreached(id);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('DMS-128: a district officer is 403 FORBIDDEN and no token is 401', async () => {
    const id = await broadcastWarning();
    const districtOfficer = await createUser({
      role: Role.DISTRICT_OFFICER,
      district: areas.colombo,
    });

    const forbidden = await unreached(id, {}, districtOfficer);
    const anonymous = await request(app).get(`/api/hazard-alerts/${id}/unreached`);

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    expect(anonymous.status).toBe(401);
  });
});
