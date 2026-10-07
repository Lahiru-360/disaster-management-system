import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { District } from '../../src/models/District.js';
import { HazardAlert } from '../../src/models/HazardAlert.js';
import { Notification } from '../../src/models/Notification.js';
import { bearerFor } from '../helpers/authHelper.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { createUser } from '../helpers/userFactory.js';

// UC01 E1, invalid target scope (contract §12.3, catalogue TC-32…TC-35): a
// 400 on areaIds that leaves the draft as it was, so the officer corrects the
// scope and resumes at step 5.
let areas;
let duty;

beforeEach(async () => {
  areas = await seedAreas();
  duty = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
});

const as = (user) => ({ Authorization: bearerFor(user) });

const startDraft = async () => {
  const res = await request(app).post('/api/hazard-alerts').set(as(duty)).send({});
  return res.body.data.alert.id;
};

const preview = (id, areaIds) =>
  request(app)
    .post(`/api/hazard-alerts/${id}/preview`)
    .set(as(duty))
    .send({ hazardType: 'FLOOD', severity: 'SEVERE', areaIds });

// E1.2: nothing from the refused preview is kept on the draft.
const expectDraftUnchanged = async (id) => {
  const draft = await HazardAlert.findById(id).lean();
  expect(draft).toMatchObject({ status: 'DRAFT', hazardType: null, severity: null, targets: [] });
};

describe('UC01 E1: invalid target scope', () => {
  it('E1: TC-32 an empty scope is 400 VALIDATION_ERROR on areaIds', async () => {
    const id = await startDraft();

    const res = await preview(id, []);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'areaIds', message: 'must contain at least 1 items' }],
    });
    await expectDraftUnchanged(id);
  });

  it('E1: TC-32 a missing scope is 400 on areaIds', async () => {
    const id = await startDraft();

    const res = await request(app)
      .post(`/api/hazard-alerts/${id}/preview`)
      .set(as(duty))
      .send({ hazardType: 'FLOOD', severity: 'SEVERE' });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([{ field: 'areaIds', message: 'is required' }]);
  });

  it('E1: TC-33 an unknown area id is 400, and the message names it', async () => {
    const id = await startDraft();
    const unknown = new mongoose.Types.ObjectId().toString();

    const res = await preview(id, [unknown]);

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'areaIds', message: `unknown area ids: ${unknown}` },
    ]);
    await expectDraftUnchanged(id);
  });

  it('E1: TC-33 an id of something that is not an area (a user) is unknown', async () => {
    const id = await startDraft();

    const res = await preview(id, [duty.id]);

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'areaIds', message: `unknown area ids: ${duty.id}` },
    ]);
  });

  it('E1: TC-34 a malformed ObjectId is 400, named with the unknown ones', async () => {
    const id = await startDraft();

    const res = await preview(id, ['colombo']);

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'areaIds', message: 'unknown area ids: colombo' },
    ]);
    await expectDraftUnchanged(id);
  });

  it.each([
    ['a number', [42]],
    ['null', [null]],
    ['an object', [{ id: 'x' }]],
    ['a valid id beside a number', ['__colombo__', 7]],
  ])('E1: TC-34 a list holding %s is 400 on areaIds as a whole', async (_case, ids) => {
    const id = await startDraft();
    const areaIds = ids.map((value) => (value === '__colombo__' ? areas.colombo.id : value));

    const res = await preview(id, areaIds);

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'areaIds', message: 'must be a list of area ids' },
    ]);
    await expectDraftUnchanged(id);
  });

  it('E1: TC-35 valid and invalid ids together are 400 naming only the bad ones, nothing saved', async () => {
    const id = await startDraft();
    const unknown = new mongoose.Types.ObjectId().toString();

    const res = await preview(id, [areas.colombo.id, unknown, areas.kelani.id, 'bad']);

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'areaIds', message: `unknown area ids: ${unknown}, bad` },
    ]);
    await expectDraftUnchanged(id);
  });

  it('E1: a river basin id is accepted as a scope', async () => {
    const id = await startDraft();

    const res = await preview(id, [areas.kelani.id]);

    expect(res.status).toBe(200);
    expect(res.body.data.alert.targets).toEqual([
      { kind: 'RiverBasin', id: areas.kelani.id, name: 'Kelani' },
    ]);
  });

  it('E1.2: the officer corrects the scope and the preview then succeeds', async () => {
    const id = await startDraft();
    await preview(id, [new mongoose.Types.ObjectId().toString()]);

    const res = await preview(id, [areas.gampaha.id]);

    expect(res.status).toBe(200);
    expect(res.body.data.alert).toMatchObject({ hazardType: 'FLOOD', severity: 'SEVERE' });
  });

  it('E1: a scope area removed after the preview is 400 on broadcast, and nothing is sent', async () => {
    await createUser({ homeDistrict: areas.kalutara });
    const id = await startDraft();
    await preview(id, [areas.kalutara.id]);
    await District.deleteOne({ _id: areas.kalutara._id });

    const res = await request(app)
      .post(`/api/hazard-alerts/${id}/broadcast`)
      .set(as(duty))
      .send({ message: 'Flood Warning: SEVERE.' });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'areaIds', message: `unknown area ids: ${areas.kalutara.id}` },
    ]);
    expect((await HazardAlert.findById(id)).status).toBe('DRAFT');
    expect(await Notification.countDocuments()).toBe(0);
  });
});
