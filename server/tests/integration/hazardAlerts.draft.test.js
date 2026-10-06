import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardAlert } from '../../src/models/HazardAlert.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { bearerFor, expiredBearerFor } from '../helpers/authHelper.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { createUser } from '../helpers/userFactory.js';

// UC01 main flow steps 1-8 through the HTTP API (contract §12.2-12.5).
let areas;
let duty;
let dmc;

beforeEach(async () => {
  areas = await seedAreas();
  duty = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
  dmc = await createUser({ role: Role.DMC_OFFICER });
});

const as = (user) => ({ Authorization: bearerFor(user) });

const startDraft = async (user = duty) => {
  const res = await request(app).post('/api/hazard-alerts').set(as(user)).send({});
  return res.body.data.alert.id;
};

const preview = (id, body, user = duty) =>
  request(app).post(`/api/hazard-alerts/${id}/preview`).set(as(user)).send(body);

const saveMessage = (id, message, user = duty) =>
  request(app).patch(`/api/hazard-alerts/${id}/draft`).set(as(user)).send({ message });

const floodIn = (...areaDocs) => ({
  hazardType: 'FLOOD',
  severity: 'SEVERE',
  areaIds: areaDocs.map((doc) => doc.id),
});

describe('POST /api/hazard-alerts', () => {
  it('DMS-120: TC-01 a duty officer starts a DRAFT, version 1, with its first history entry', async () => {
    const res = await request(app).post('/api/hazard-alerts').set(as(duty)).send({});

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alert).toMatchObject({
      referenceNo: expect.stringMatching(/^HA-\d{4}$/),
      status: 'DRAFT',
      version: 1,
      hazardType: null,
      severity: null,
      message: null,
      targets: [],
      createdBy: { id: duty.id, name: duty.name },
      issuedBy: null,
      issuedAt: null,
    });
    expect(res.body.data.alert.statusHistory).toEqual([
      {
        status: 'DRAFT',
        version: 1,
        at: expect.any(String),
        by: { id: duty.id, name: duty.name },
      },
    ]);
  });

  it('DMS-120: a dmc_officer may start one too', async () => {
    const res = await request(app).post('/api/hazard-alerts').set(as(dmc)).send({});

    expect(res.status).toBe(201);
  });

  it.each([Role.DISTRICT_OFFICER, Role.CITIZEN, Role.COMMUNITY_VOLUNTEER, Role.RESCUE_TEAM_LEAD])(
    'DMS-120: TC-02 a %s is 403 FORBIDDEN, and no draft is made',
    async (role) => {
      const res = await request(app)
        .post('/api/hazard-alerts')
        .set(as(await createUser({ role })))
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(await HazardAlert.countDocuments()).toBe(0);
    },
  );

  it('DMS-120: TC-03 no token is 401 AUTH_HEADER_MISSING', async () => {
    const res = await request(app).post('/api/hazard-alerts').send({});

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_HEADER_MISSING');
  });

  it('DMS-120: TC-03 an expired token is 401 TOKEN_EXPIRED', async () => {
    const res = await request(app)
      .post('/api/hazard-alerts')
      .set('Authorization', expiredBearerFor(duty))
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('POST /api/hazard-alerts/:id/preview', () => {
  it('DMS-120: TC-04 counts the citizens of Colombo and Gampaha and returns the preview', async () => {
    for (const homeDistrict of [areas.colombo, areas.colombo, areas.gampaha, areas.kalutara]) {
      await createUser({ homeDistrict });
    }
    const id = await startDraft();

    const res = await preview(id, floodIn(areas.colombo, areas.gampaha));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      alert: expect.objectContaining({
        id,
        status: 'DRAFT',
        hazardType: 'FLOOD',
        severity: 'SEVERE',
        targets: [
          { kind: 'District', id: areas.colombo.id, name: 'Colombo' },
          { kind: 'District', id: areas.gampaha.id, name: 'Gampaha' },
        ],
      }),
      recipientCount: 3,
      message: 'Flood Warning: SEVERE. Move to higher ground and follow official guidance.',
      channels: [
        { channel: 'PUSH', ready: true },
        { channel: 'SMS', ready: true },
        { channel: 'AUDIBLE', ready: true },
      ],
      activeWarning: null,
    });
    expect(res.body.data.alert.message).toBe(res.body.data.message);
  });

  it('DMS-120: TC-05 Colombo plus the Kelani basin counts each citizen once', async () => {
    await createUser({ homeDistrict: areas.colombo });
    await createUser({ role: Role.COMMUNITY_VOLUNTEER, homeDistrict: areas.gampaha });
    const id = await startDraft();

    const res = await preview(id, floodIn(areas.colombo, areas.kelani));

    expect(res.body.data.recipientCount).toBe(2);
  });

  it('DMS-120: E2 no citizens in scope is 200 with recipientCount 0', async () => {
    const id = await startDraft();

    const res = await preview(id, floodIn(areas.kalutara));

    expect(res.status).toBe(200);
    expect(res.body.data.recipientCount).toBe(0);
  });

  it('DMS-120: a colleague can preview a draft someone else started (drafts are shared)', async () => {
    const id = await startDraft(duty);

    const res = await preview(id, floodIn(areas.colombo), dmc);

    expect(res.status).toBe(200);
  });

  it('DMS-120: a missing type, severity and scope are one 400 entry each', async () => {
    const id = await startDraft();

    const res = await preview(id, {});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([
      { field: 'hazardType', message: 'is required' },
      { field: 'severity', message: 'is required' },
      { field: 'areaIds', message: 'is required' },
    ]);
  });

  it("DMS-120: UC02's report hazard types and unknown severities are refused", async () => {
    const id = await startDraft();

    const res = await preview(id, {
      hazardType: 'RISING_RIVER_FLOOD',
      severity: 'EXTREME',
      areaIds: [areas.colombo.id],
    });

    expect(res.body.error.errors).toEqual([
      { field: 'hazardType', message: 'must be one of [FLOOD, LANDSLIDE, CYCLONE, DROUGHT]' },
      { field: 'severity', message: 'must be one of [LOW, MEDIUM, HIGH, SEVERE]' },
    ]);
  });

  it.each([
    ['an empty scope', () => [], 'must contain at least 1 items'],
    ['a scope that is not a list', () => 'colombo', 'must be a list of area ids'],
  ])('DMS-120: E1 %s is a 400 on areaIds', async (_case, areaIdsFor, message) => {
    const id = await startDraft();

    const res = await preview(id, {
      hazardType: 'FLOOD',
      severity: 'LOW',
      areaIds: areaIdsFor(),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([{ field: 'areaIds', message }]);
  });

  it('DMS-120: E1 unknown and malformed area ids are named on areaIds, and the draft is unchanged', async () => {
    const id = await startDraft();
    const unknown = new mongoose.Types.ObjectId().toString();

    const res = await preview(id, {
      hazardType: 'FLOOD',
      severity: 'LOW',
      areaIds: [areas.colombo.id, unknown, 'bad'],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'areaIds', message: `unknown area ids: ${unknown}, bad` },
    ]);
    expect((await HazardAlert.findById(id)).targets).toHaveLength(0);
  });

  it('DMS-120: previewing an alert that is no longer a draft is 409 INVALID_ALERT_TRANSITION', async () => {
    const id = await startDraft();
    await HazardAlert.updateOne({ _id: id }, { status: 'BROADCAST' });

    const res = await preview(id, floodIn(areas.colombo));

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_ALERT_TRANSITION',
      message: 'Only a DRAFT alert can be previewed – current status: BROADCAST',
    });
  });

  it('DMS-120: a citizen cannot preview', async () => {
    const id = await startDraft();

    const res = await preview(id, floodIn(areas.colombo), await createUser());

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/hazard-alerts/:id/draft', () => {
  it('DMS-120: saves the edited message, trimmed', async () => {
    const id = await startDraft();
    await preview(id, floodIn(areas.colombo));

    const res = await saveMessage(
      id,
      '  Move to higher ground now. Kelani river is rising fast.  ',
    );

    expect(res.status).toBe(200);
    expect(res.body.data.alert.message).toBe(
      'Move to higher ground now. Kelani river is rising fast.',
    );
  });

  it('DMS-120: TC-07 a message of exactly 160 characters is saved', async () => {
    const id = await startDraft();

    const res = await saveMessage(id, 'x'.repeat(160));

    expect(res.status).toBe(200);
    expect(res.body.data.alert.message).toHaveLength(160);
  });

  it('DMS-120: TC-08 161 characters is 400 VALIDATION_ERROR on message', async () => {
    const id = await startDraft();

    const res = await saveMessage(id, 'x'.repeat(161));

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'message', message: 'length must be less than or equal to 160 characters long' },
    ]);
    expect((await HazardAlert.findById(id)).message).toBeNull();
  });

  it.each([
    ['missing', undefined],
    ['blank', '   '],
  ])('DMS-120: a %s message is 400 is required', async (_case, message) => {
    const id = await startDraft();

    const res = await saveMessage(id, message);

    expect(res.body.error.errors).toEqual([{ field: 'message', message: 'is required' }]);
  });

  it('DMS-120: editing a CANCELLED alert is 409', async () => {
    const id = await startDraft();
    await HazardAlert.updateOne({ _id: id }, { status: 'CANCELLED' });

    const res = await saveMessage(id, 'Too late');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_ALERT_TRANSITION');
  });
});

describe('GET /api/hazard-alerts/:id', () => {
  it('DMS-120: returns the alert as last composed', async () => {
    const id = await startDraft();
    await preview(id, floodIn(areas.kelani));
    await saveMessage(id, 'Edited.');

    const res = await request(app).get(`/api/hazard-alerts/${id}`).set(as(dmc));

    expect(res.status).toBe(200);
    expect(res.body.data.alert).toMatchObject({
      id,
      message: 'Edited.',
      targets: [{ kind: 'RiverBasin', id: areas.kelani.id, name: 'Kelani' }],
    });
  });

  it.each([
    ['an unknown id', () => new mongoose.Types.ObjectId().toString()],
    ['a malformed id', () => 'not-an-id'],
  ])('DMS-120: %s is 404 NOT_FOUND on every endpoint', async (_case, idFor) => {
    const id = idFor();

    const responses = await Promise.all([
      request(app).get(`/api/hazard-alerts/${id}`).set(as(duty)),
      preview(id, floodIn(areas.colombo)),
      saveMessage(id, 'x'),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Hazard alert not found.' });
    }
  });

  it('DMS-120: a district officer cannot read an alert', async () => {
    const id = await startDraft();

    const res = await request(app)
      .get(`/api/hazard-alerts/${id}`)
      .set(as(await createUser({ role: Role.DISTRICT_OFFICER })));

    expect(res.status).toBe(403);
  });
});

it('DMS-120: composing a warning sends nothing and creates no inbox item', async () => {
  await createUser({ homeDistrict: areas.colombo });
  const id = await startDraft();
  await preview(id, floodIn(areas.colombo));
  await saveMessage(id, 'Edited.');

  expect(await UserNotification.countDocuments()).toBe(0);
  expect((await HazardAlert.findById(id)).status).toBe('DRAFT');
});
