import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardAlert } from '../../src/models/HazardAlert.js';
import { Notification } from '../../src/models/Notification.js';
import { bearerFor } from '../helpers/authHelper.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { createUser } from '../helpers/userFactory.js';

// UC01 A2, an active warning already exists → update it (contract §12.3,
// §12.6, §12.13 and §12.14, catalogue TC-20…TC-25), through the real app.
let areas;
let duty;

beforeEach(async () => {
  areas = await seedAreas();
  duty = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
});

const as = (user) => ({ Authorization: bearerFor(user) });

const UPDATE_MESSAGE =
  'UPDATE: Flood Warning now SEVERE. Move to higher ground and follow official guidance.';

const citizensIn = async (district, count) => {
  const citizens = [];
  for (let i = 0; i < count; i += 1) citizens.push(await createUser({ homeDistrict: district }));
  return citizens;
};

const startDraft = async () => {
  const res = await request(app).post('/api/hazard-alerts').set(as(duty)).send({});
  return res.body.data.alert.id;
};

const preview = (id, scope, { hazardType = 'FLOOD', severity = 'HIGH' } = {}) =>
  request(app)
    .post(`/api/hazard-alerts/${id}/preview`)
    .set(as(duty))
    .send({ hazardType, severity, areaIds: scope.map((area) => area.id) });

const broadcast = (id) =>
  request(app)
    .post(`/api/hazard-alerts/${id}/broadcast`)
    .set(as(duty))
    .send({ message: 'Flood Warning: HIGH. Move to higher ground.' });

// A HIGH warning broadcast to the scope: active, version 1.
const activeWarning = async (scope, options) => {
  const id = await startDraft();
  await preview(id, scope, options);
  const res = await broadcast(id);
  expect(res.status).toBe(200);
  return res.body.data.alert;
};

const previewUpdate = (id, body, user = duty) =>
  request(app).post(`/api/hazard-alerts/${id}/update-preview`).set(as(user)).send(body);

const update = (id, body, user = duty) =>
  request(app)
    .patch(`/api/hazard-alerts/${id}`)
    .set(as(user))
    .send({ message: UPDATE_MESSAGE, ...body });

const recipientsOf = async (id, version) =>
  new Set(
    (await Notification.find({ alert: id, alertVersion: version }).lean()).map((record) =>
      record.citizen.toString(),
    ),
  );

describe('UC01 A2: an active warning already covers the scope', () => {
  it('A2: TC-20 the preview of a new draft returns the active warning on the same district', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);
    const draft = await startDraft();

    const res = await preview(draft, [areas.colombo], { severity: 'SEVERE' });

    expect(res.status).toBe(200);
    expect(res.body.data.activeWarning).toEqual({
      id: active.id,
      referenceNo: active.referenceNo,
      hazardType: 'FLOOD',
      severity: 'HIGH',
      targets: [{ kind: 'District', id: areas.colombo.id, name: 'Colombo' }],
      version: 1,
    });
  });

  it('A2: TC-21 a basin warning is found from a district it spans', async () => {
    await citizensIn(areas.gampaha, 1);
    const active = await activeWarning([areas.kelani]);
    const draft = await startDraft();

    const res = await preview(draft, [areas.gampaha]);

    expect(res.body.data.activeWarning).toMatchObject({ id: active.id });
  });

  it('A2: TC-21 a district warning is found from a basin that spans it', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);
    const draft = await startDraft();

    const res = await preview(draft, [areas.kelani]);

    expect(res.body.data.activeWarning).toMatchObject({ id: active.id });
  });

  it('A2: TC-22 a different hazard type on the same district is no conflict', async () => {
    await citizensIn(areas.colombo, 1);
    await activeWarning([areas.colombo], { hazardType: 'CYCLONE' });
    const draft = await startDraft();

    const previewed = await preview(draft, [areas.colombo]);
    const res = await broadcast(draft);

    expect(previewed.body.data.activeWarning).toBeNull();
    expect(res.status).toBe(200);
  });

  it('A2: a district with no overlap is no conflict', async () => {
    await citizensIn(areas.colombo, 1);
    await citizensIn(areas.kalutara, 1);
    await activeWarning([areas.kelani]);
    const draft = await startDraft();

    const res = await preview(draft, [areas.kalutara]);

    expect(res.body.data.activeWarning).toBeNull();
  });

  it('A2: a CANCELLED warning is ignored, and a new one can be broadcast', async () => {
    await citizensIn(areas.colombo, 1);
    const cancelled = await activeWarning([areas.colombo]);
    await HazardAlert.updateOne({ _id: cancelled.id }, { status: 'CANCELLED' });
    const draft = await startDraft();

    const previewed = await preview(draft, [areas.colombo]);
    const res = await broadcast(draft);

    expect(previewed.body.data.activeWarning).toBeNull();
    expect(res.status).toBe(200);
  });

  it('A2: TC-23 broadcasting a new draft while a conflict exists is 409 and sends nothing', async () => {
    await citizensIn(areas.colombo, 2);
    const active = await activeWarning([areas.kelani]);
    const draft = await startDraft();
    await preview(draft, [areas.colombo]);

    const res = await broadcast(draft);

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'ACTIVE_WARNING_EXISTS',
      message: `An active FLOOD warning (${active.referenceNo}) already covers this scope – update it instead`,
    });
    expect(await HazardAlert.findById(draft).lean()).toMatchObject({ status: 'DRAFT' });
    expect(await Notification.countDocuments({ alert: draft })).toBe(0);
  });

  it('A2: TC-23 an UPDATED warning still blocks a duplicate broadcast', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);
    await update(active.id, { severity: 'SEVERE' });
    const draft = await startDraft();
    await preview(draft, [areas.colombo]);

    const res = await broadcast(draft);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACTIVE_WARNING_EXISTS');
  });
});

describe('UC01 A2: POST /api/hazard-alerts/:id/update-preview', () => {
  it('A2: recalculates the recipients, writes the update message, and changes nothing', async () => {
    await citizensIn(areas.colombo, 2);
    await citizensIn(areas.gampaha, 3);
    const active = await activeWarning([areas.colombo]);

    const res = await previewUpdate(active.id, {
      severity: 'SEVERE',
      areaIds: [areas.colombo.id, areas.gampaha.id],
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      alert: { id: active.id, status: 'BROADCAST', severity: 'HIGH', version: 1 },
      nextVersion: 2,
      recipientCount: 5,
      message: UPDATE_MESSAGE,
      activeWarning: null,
    });
    expect(res.body.data.channels.map(({ channel }) => channel)).toEqual([
      'PUSH',
      'SMS',
      'AUDIBLE',
    ]);
    expect(await HazardAlert.findById(active.id).lean()).toMatchObject({
      status: 'BROADCAST',
      version: 1,
      severity: 'HIGH',
    });
  });

  it('A2: returns another active warning the new scope would duplicate', async () => {
    await citizensIn(areas.colombo, 1);
    await citizensIn(areas.gampaha, 1);
    const active = await activeWarning([areas.colombo]);
    const other = await activeWarning([areas.gampaha]);

    const res = await previewUpdate(active.id, { areaIds: [areas.kelani.id] });

    expect(res.body.data.activeWarning).toMatchObject({ id: other.id });
  });

  it('A2: neither severity nor areaIds is 400 on severity', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);

    const res = await previewUpdate(active.id, {});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'severity', message: 'change the severity or the scope' }],
    });
  });

  it('A2: an unknown severity or area id is 400 (E1)', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);
    const unknown = new mongoose.Types.ObjectId().toString();

    const badSeverity = await previewUpdate(active.id, { severity: 'EXTREME' });
    const badArea = await previewUpdate(active.id, { areaIds: [unknown] });
    const empty = await previewUpdate(active.id, { areaIds: [] });

    expect(badSeverity.status).toBe(400);
    expect(badSeverity.body.error.errors[0].field).toBe('severity');
    expect(badArea.status).toBe(400);
    expect(badArea.body.error.errors).toEqual([
      { field: 'areaIds', message: `unknown area ids: ${unknown}` },
    ]);
    expect(empty.status).toBe(400);
    expect(empty.body.error.errors[0].field).toBe('areaIds');
  });

  it('A2: a DRAFT is 409 INVALID_ALERT_TRANSITION', async () => {
    const draft = await startDraft();

    const res = await previewUpdate(draft, { severity: 'SEVERE' });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_ALERT_TRANSITION',
      message: 'Only an active alert can be updated – current status: DRAFT',
    });
  });

  it('A2: an unknown alert is 404, and a citizen is 403', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);
    const citizen = await createUser({ homeDistrict: areas.colombo });

    const missing = await previewUpdate(new mongoose.Types.ObjectId().toString(), {
      severity: 'LOW',
    });
    const forbidden = await previewUpdate(active.id, { severity: 'LOW' }, citizen);

    expect(missing.status).toBe(404);
    expect(forbidden.status).toBe(403);
  });
});

describe('UC01 A2: PATCH /api/hazard-alerts/:id', () => {
  it('A2: TC-24 sets UPDATED, version 2, the new severity and scope, and a history entry', async () => {
    await citizensIn(areas.colombo, 1);
    await citizensIn(areas.gampaha, 1);
    const active = await activeWarning([areas.colombo]);

    const res = await update(active.id, {
      severity: 'SEVERE',
      areaIds: [areas.colombo.id, areas.gampaha.id],
    });

    expect(res.status).toBe(200);
    const { alert } = res.body.data;
    expect(alert).toMatchObject({
      id: active.id,
      status: 'UPDATED',
      version: 2,
      severity: 'SEVERE',
      message: UPDATE_MESSAGE,
      issuedAt: active.issuedAt,
      issuedBy: { id: duty.id },
    });
    expect(alert.targets.map((target) => target.id)).toEqual([areas.colombo.id, areas.gampaha.id]);
    expect(alert.statusHistory.map(({ status, version }) => [status, version])).toEqual([
      ['DRAFT', 1],
      ['BROADCAST', 1],
      ['UPDATED', 2],
    ]);
  });

  it('A2: TC-24 versions go 1 → 2 → 3, one history entry each', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);

    const second = await update(active.id, { severity: 'SEVERE' });
    const third = await update(active.id, {
      severity: 'MEDIUM',
      message: 'UPDATE: Flood Warning now MEDIUM.',
    });

    expect(second.body.data.alert.version).toBe(2);
    expect(third.status).toBe(200);
    expect(third.body.data.alert).toMatchObject({ status: 'UPDATED', version: 3 });
    expect(
      third.body.data.alert.statusHistory
        .filter(({ status }) => status === 'UPDATED')
        .map(({ version }) => version),
    ).toEqual([2, 3]);
  });

  it('A2: TC-25 the update goes to the recalculated recipients as kind UPDATE for the new version', async () => {
    const [leaves] = await citizensIn(areas.colombo, 1);
    const [stays] = await citizensIn(areas.gampaha, 1);
    const [joins] = await citizensIn(areas.kalutara, 1);
    const active = await activeWarning([areas.kelani]);

    const res = await update(active.id, { areaIds: [areas.gampaha.id, areas.kalutara.id] });

    expect(res.status).toBe(200);
    expect(await recipientsOf(active.id, 1)).toEqual(new Set([leaves.id, stays.id]));
    expect(await recipientsOf(active.id, 2)).toEqual(new Set([stays.id, joins.id]));
    const updates = await Notification.find({ alert: active.id, alertVersion: 2 }).lean();
    expect(updates).toHaveLength(2 * 3);
    expect(updates.every((record) => record.kind === 'UPDATE')).toBe(true);
  });

  it('A2: TC-25 the delivery summary is for the new version', async () => {
    await citizensIn(areas.colombo, 1);
    await citizensIn(areas.gampaha, 2);
    const active = await activeWarning([areas.colombo]);

    const res = await update(active.id, { areaIds: [areas.kelani.id] });
    const reopened = await request(app)
      .get(`/api/hazard-alerts/${active.id}/delivery-summary`)
      .set(as(duty));

    expect(res.body.data.summary).toMatchObject({
      version: 2,
      totals: { sent: 9, delivered: 9, failed: 0 },
    });
    expect(reopened.body.data.summary).toMatchObject({ version: 2, totals: { sent: 9 } });
  });

  it('A2: the new draft that found the conflict is discarded once the update is sent', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);
    const draft = await startDraft();
    await preview(draft, [areas.colombo], { severity: 'SEVERE' });

    const res = await update(active.id, { severity: 'SEVERE', replacesDraftId: draft });

    expect(res.status).toBe(200);
    expect(await HazardAlert.findById(draft)).toBeNull();
  });

  it('A2: an update that changes nothing is 400 and sends nothing', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);

    const res = await update(active.id, { severity: 'HIGH', areaIds: [areas.colombo.id] });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'severity', message: 'change the severity or the scope' },
    ]);
    expect(await Notification.countDocuments({ alert: active.id, alertVersion: 2 })).toBe(0);
  });

  it.each([
    ['missing', undefined],
    ['blank', '   '],
    ['161-character', 'x'.repeat(161)],
  ])('A2: a %s message is 400 on message', async (_case, message) => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);

    const res = await update(active.id, { severity: 'SEVERE', message });

    expect(res.status).toBe(400);
    expect(res.body.error.errors.map(({ field }) => field)).toEqual(['message']);
  });

  it('A2: an empty replacesDraftId is 400', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);

    const res = await update(active.id, { severity: 'SEVERE', replacesDraftId: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.errors[0].field).toBe('replacesDraftId');
  });

  it('A2: a DRAFT or CANCELLED alert is 409 and nothing is sent', async () => {
    await citizensIn(areas.colombo, 1);
    await citizensIn(areas.kalutara, 1);
    const draft = await startDraft();
    await preview(draft, [areas.colombo]);
    const cancelled = await activeWarning([areas.kalutara], { hazardType: 'CYCLONE' });
    await HazardAlert.updateOne({ _id: cancelled.id }, { status: 'CANCELLED' });

    const fromDraft = await update(draft, { severity: 'SEVERE' });
    const fromCancelled = await update(cancelled.id, { severity: 'SEVERE' });

    expect(fromDraft.status).toBe(409);
    expect(fromDraft.body.error.code).toBe('INVALID_ALERT_TRANSITION');
    expect(fromCancelled.status).toBe(409);
    expect(fromCancelled.body.error.message).toBe(
      'Only an active alert can be updated – current status: CANCELLED',
    );
    expect(await Notification.countDocuments({ kind: 'UPDATE' })).toBe(0);
  });

  it('A2: a new scope with no citizens is 409 NO_RECIPIENTS_IN_SCOPE and keeps the draft (E2)', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);
    const draft = await startDraft();

    const res = await update(active.id, { areaIds: [areas.kalutara.id], replacesDraftId: draft });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_RECIPIENTS_IN_SCOPE');
    expect(await HazardAlert.findById(active.id).lean()).toMatchObject({ version: 1 });
    expect(await HazardAlert.findById(draft)).not.toBeNull();
  });

  it('A2: a new scope another active warning covers is 409 ACTIVE_WARNING_EXISTS', async () => {
    await citizensIn(areas.colombo, 1);
    await citizensIn(areas.gampaha, 1);
    const active = await activeWarning([areas.colombo]);
    const other = await activeWarning([areas.gampaha]);

    const res = await update(active.id, { areaIds: [areas.colombo.id, areas.gampaha.id] });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'ACTIVE_WARNING_EXISTS',
      message: `An active FLOOD warning (${other.referenceNo}) already covers this scope – update it instead`,
    });
    expect(await Notification.countDocuments({ kind: 'UPDATE' })).toBe(0);
  });

  it('A2: an unknown alert is 404, and a citizen is 403', async () => {
    await citizensIn(areas.colombo, 1);
    const active = await activeWarning([areas.colombo]);
    const citizen = await createUser({ homeDistrict: areas.colombo });

    const missing = await update(new mongoose.Types.ObjectId().toString(), { severity: 'LOW' });
    const forbidden = await update(active.id, { severity: 'LOW' }, citizen);

    expect(missing.status).toBe(404);
    expect(forbidden.status).toBe(403);
  });
});
