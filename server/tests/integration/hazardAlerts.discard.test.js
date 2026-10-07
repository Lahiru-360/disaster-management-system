import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardAlert } from '../../src/models/HazardAlert.js';
import { Notification } from '../../src/models/Notification.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { bearerFor } from '../helpers/authHelper.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { createUser } from '../helpers/userFactory.js';

// UC01 A4 through the HTTP API: backing out of the confirmation, discarding a
// draft and listing the drafts to resume (contract §12.11-12.12).
let areas;
let duty;
let dmc;

beforeEach(async () => {
  areas = await seedAreas();
  duty = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
  dmc = await createUser({ role: Role.DMC_OFFICER });
  for (const homeDistrict of [areas.colombo, areas.gampaha]) {
    await createUser({ homeDistrict });
  }
});

const as = (user) => ({ Authorization: bearerFor(user) });

const MESSAGE = 'Flood Warning: SEVERE. Move to higher ground now.';

const startDraft = async (user = duty) => {
  const res = await request(app).post('/api/hazard-alerts').set(as(user)).send({});
  return res.body.data.alert.id;
};

const previewedDraft = async (user = duty) => {
  const id = await startDraft(user);
  await request(app)
    .post(`/api/hazard-alerts/${id}/preview`)
    .set(as(user))
    .send({ hazardType: 'FLOOD', severity: 'SEVERE', areaIds: [areas.colombo.id] });
  return id;
};

const broadcastAlert = async () => {
  const id = await previewedDraft();
  await request(app)
    .post(`/api/hazard-alerts/${id}/broadcast`)
    .set(as(duty))
    .send({ message: MESSAGE });
  return id;
};

const discard = (id, user = duty) => request(app).delete(`/api/hazard-alerts/${id}`).set(as(user));

const listDrafts = (query = { status: 'draft' }, user = duty) =>
  request(app).get('/api/hazard-alerts').query(query).set(as(user));

describe('DELETE /api/hazard-alerts/:id', () => {
  it('A4: TC-30 discards a previewed draft: 200, the document removed, 0 notifications', async () => {
    const id = await previewedDraft();

    const res = await discard(id);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alert).toMatchObject({
      id,
      status: 'DRAFT',
      hazardType: 'FLOOD',
      severity: 'SEVERE',
      targets: [{ kind: 'District', id: areas.colombo.id, name: 'Colombo' }],
    });
    expect(await HazardAlert.exists({ _id: id })).toBeNull();
    expect(await Notification.countDocuments()).toBe(0);
    expect(await UserNotification.countDocuments()).toBe(0);
  });

  it('A4: TC-30 a draft that was never previewed can be discarded too', async () => {
    const id = await startDraft();

    const res = await discard(id);

    expect(res.status).toBe(200);
    expect(res.body.data.alert).toMatchObject({ id, hazardType: null, targets: [] });
    expect(await HazardAlert.countDocuments()).toBe(0);
  });

  it('A4: TC-30 a discarded draft is gone: reading or discarding it again is 404', async () => {
    const id = await previewedDraft();
    await discard(id);

    const read = await request(app).get(`/api/hazard-alerts/${id}`).set(as(duty));
    const again = await discard(id);

    expect(read.status).toBe(404);
    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe('NOT_FOUND');
  });

  it("A4: any officer may discard a colleague's draft (drafts are shared work)", async () => {
    const id = await previewedDraft(duty);

    const res = await discard(id, dmc);

    expect(res.status).toBe(200);
  });

  it('A4: TC-31 discarding a BROADCAST alert is 409 and leaves it and its deliveries', async () => {
    const id = await broadcastAlert();
    const deliveries = await Notification.countDocuments({ alert: id });

    const res = await discard(id);

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_ALERT_TRANSITION',
      message: 'Only a DRAFT alert can be discarded – current status: BROADCAST',
    });
    expect(await HazardAlert.findById(id).lean()).toMatchObject({ status: 'BROADCAST' });
    expect(deliveries).toBeGreaterThan(0);
    expect(await Notification.countDocuments({ alert: id })).toBe(deliveries);
  });

  it.each(['UPDATED', 'CANCELLED'])(
    'A4: TC-31 discarding an %s alert is 409 too',
    async (status) => {
      const id = await broadcastAlert();
      await HazardAlert.updateOne({ _id: id }, { status });

      const res = await discard(id);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe(
        `Only a DRAFT alert can be discarded – current status: ${status}`,
      );
      expect(await HazardAlert.exists({ _id: id })).not.toBeNull();
    },
  );

  it.each([
    ['an unknown id', () => new mongoose.Types.ObjectId().toString()],
    ['a malformed id', () => 'not-an-id'],
  ])('A4: %s is 404 NOT_FOUND', async (_case, idFor) => {
    const res = await discard(idFor());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('A4: a district_officer is 403 FORBIDDEN, and the draft stays', async () => {
    const id = await previewedDraft();
    const districtOfficer = await createUser({
      role: Role.DISTRICT_OFFICER,
      district: areas.colombo,
    });

    const res = await discard(id, districtOfficer);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await HazardAlert.exists({ _id: id })).not.toBeNull();
  });

  it('A4: no token is 401 AUTH_HEADER_MISSING', async () => {
    const id = await startDraft();

    const res = await request(app).delete(`/api/hazard-alerts/${id}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_HEADER_MISSING');
  });
});

describe('A4 Back from the confirmation', () => {
  it('A4: backing out sends nothing: the draft keeps its type, severity, scope and edited message', async () => {
    const id = await previewedDraft();
    await request(app).patch(`/api/hazard-alerts/${id}/draft`).set(as(duty)).send({
      message: MESSAGE,
    });

    // Back only closes the dialog, so no broadcast request is made.
    const res = await request(app).get(`/api/hazard-alerts/${id}`).set(as(duty));

    expect(res.body.data.alert).toMatchObject({
      status: 'DRAFT',
      hazardType: 'FLOOD',
      severity: 'SEVERE',
      message: MESSAGE,
      targets: [{ kind: 'District', id: areas.colombo.id, name: 'Colombo' }],
      issuedBy: null,
    });
    expect(await Notification.countDocuments()).toBe(0);
    expect(await UserNotification.countDocuments()).toBe(0);
  });
});

describe('GET /api/hazard-alerts?status=draft', () => {
  it('A4: lists every DRAFT, whoever started it, most recently changed first', async () => {
    const older = await previewedDraft(duty);
    const blank = await startDraft(dmc);
    const newest = await previewedDraft(duty);
    const stamp = (id, iso) =>
      HazardAlert.updateOne({ _id: id }, { updatedAt: new Date(iso) }, { timestamps: false });
    await stamp(older, '2026-10-02T06:00:00.000Z');
    await stamp(blank, '2026-10-02T06:10:00.000Z');
    await stamp(newest, '2026-10-02T06:20:00.000Z');

    const res = await listDrafts();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alerts.map(({ id }) => id)).toEqual([newest, blank, older]);
    expect(res.body.data.alerts[1]).toMatchObject({
      status: 'DRAFT',
      hazardType: null,
      targets: [],
      createdBy: { id: dmc.id, name: dmc.name },
    });
  });

  it('A4: leaves out broadcast and discarded alerts', async () => {
    const kept = await previewedDraft();
    await broadcastAlert();
    await discard(await previewedDraft());

    const res = await listDrafts();

    expect(res.body.data.alerts.map(({ id }) => id)).toEqual([kept]);
  });

  it('A4: no drafts is 200 with []', async () => {
    const res = await listDrafts();

    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toEqual([]);
  });

  it.each([
    ['missing', {}, 'is required'],
    ['not draft or active', { status: 'cancelled' }, 'must be one of [draft, active]'],
  ])('A4: status %s is 400 VALIDATION_ERROR on status', async (_case, query, message) => {
    const res = await listDrafts(query);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'status', message }],
    });
  });

  it('A4: a citizen is 403 FORBIDDEN', async () => {
    const res = await listDrafts({ status: 'draft' }, await createUser({ role: Role.CITIZEN }));

    expect(res.status).toBe(403);
  });
});
