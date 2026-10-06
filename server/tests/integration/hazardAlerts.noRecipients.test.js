import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardAlert } from '../../src/models/HazardAlert.js';
import { Notification } from '../../src/models/Notification.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { bearerFor } from '../helpers/authHelper.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { createUser } from '../helpers/userFactory.js';

// UC01 E2, no recipients in scope (contract §12.3 and §12.6, catalogue
// TC-36…TC-38): the preview reports 0 and the broadcast is refused, so the
// officer changes the scope and resumes at step 5.
let areas;
let duty;

beforeEach(async () => {
  areas = await seedAreas();
  duty = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
});

const as = (user) => ({ Authorization: bearerFor(user) });

const MESSAGE = 'Flood Warning: SEVERE. Move to higher ground and follow official guidance.';

const startDraft = async () => {
  const res = await request(app).post('/api/hazard-alerts').set(as(duty)).send({});
  return res.body.data.alert.id;
};

const preview = (id, ...areaDocs) =>
  request(app)
    .post(`/api/hazard-alerts/${id}/preview`)
    .set(as(duty))
    .send({ hazardType: 'FLOOD', severity: 'SEVERE', areaIds: areaDocs.map((doc) => doc.id) });

const broadcast = (id) =>
  request(app).post(`/api/hazard-alerts/${id}/broadcast`).set(as(duty)).send({ message: MESSAGE });

// E2.2: refused, still a DRAFT, and nothing sent on any channel or inbox.
const expectRefusedAndNothingSent = async (res, id) => {
  expect(res.status).toBe(409);
  expect(res.body.error).toEqual({
    code: 'NO_RECIPIENTS_IN_SCOPE',
    message: 'No registered citizens are in the selected scope',
  });
  const alert = await HazardAlert.findById(id).lean();
  expect(alert.status).toBe('DRAFT');
  expect(alert.issuedBy ?? null).toBeNull();
  expect(await Notification.countDocuments()).toBe(0);
  expect(await UserNotification.countDocuments()).toBe(0);
};

describe('UC01 E2: no recipients in scope', () => {
  it('DMS-127: TC-36 previewing a district with no citizens is 200 with recipientCount 0', async () => {
    const id = await startDraft();

    const res = await preview(id, areas.kalutara);

    expect(res.status).toBe(200);
    expect(res.body.data.recipientCount).toBe(0);
    expect(res.body.data.alert.status).toBe('DRAFT');
  });

  it('DMS-127: TC-37 broadcasting to a district with no citizens is 409 NO_RECIPIENTS_IN_SCOPE', async () => {
    const id = await startDraft();
    await preview(id, areas.kalutara);

    const res = await broadcast(id);

    await expectRefusedAndNothingSent(res, id);
  });

  it('DMS-127: TC-37 citizens only in an unselected district are not recipients', async () => {
    await createUser({ homeDistrict: areas.colombo });
    await createUser({ homeDistrict: areas.gampaha });
    const id = await startDraft();

    const previewed = await preview(id, areas.kalutara);
    const res = await broadcast(id);

    expect(previewed.body.data.recipientCount).toBe(0);
    await expectRefusedAndNothingSent(res, id);
  });

  it('DMS-127: TC-37 deactivated citizens are not counted, so the broadcast is refused', async () => {
    await createUser({ homeDistrict: areas.kalutara, isActive: false });
    const id = await startDraft();

    const previewed = await preview(id, areas.kalutara);
    const res = await broadcast(id);

    expect(previewed.body.data.recipientCount).toBe(0);
    await expectRefusedAndNothingSent(res, id);
  });

  it('DMS-127: TC-37 officers living in the scope are not citizens to warn', async () => {
    await createUser({ role: Role.DISTRICT_OFFICER, homeDistrict: areas.kalutara });
    const id = await startDraft();
    await preview(id, areas.kalutara);

    const res = await broadcast(id);

    await expectRefusedAndNothingSent(res, id);
  });

  it('DMS-127: the scope is counted again at broadcast: citizens who left since the preview', async () => {
    const citizen = await createUser({ homeDistrict: areas.kalutara });
    const id = await startDraft();
    const previewed = await preview(id, areas.kalutara);
    await citizen.updateOne({ isActive: false });

    const res = await broadcast(id);

    expect(previewed.body.data.recipientCount).toBe(1);
    await expectRefusedAndNothingSent(res, id);
  });

  it('DMS-127: TC-38 exactly one citizen in scope is broadcast to', async () => {
    const citizen = await createUser({ homeDistrict: areas.kalutara });
    const id = await startDraft();
    const previewed = await preview(id, areas.kalutara);

    const res = await broadcast(id);

    expect(previewed.body.data.recipientCount).toBe(1);
    expect(res.status).toBe(200);
    expect(res.body.data.alert.status).toBe('BROADCAST');
    expect(await Notification.countDocuments({ citizen: citizen._id })).toBe(3);
  });

  it('DMS-127: E2.2 the officer changes the scope and can then broadcast', async () => {
    await createUser({ homeDistrict: areas.colombo });
    const id = await startDraft();
    await preview(id, areas.kalutara);
    await broadcast(id);

    const previewed = await preview(id, areas.colombo);
    const res = await broadcast(id);

    expect(previewed.body.data.recipientCount).toBe(1);
    expect(res.status).toBe(200);
    expect(await Notification.countDocuments()).toBe(3);
  });

  it('DMS-127: a draft that was never previewed is still INVALID_ALERT_TRANSITION, not E2', async () => {
    const id = await startDraft();

    const res = await broadcast(id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_ALERT_TRANSITION');
  });
});
