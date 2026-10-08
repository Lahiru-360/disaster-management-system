import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardAlert } from '../../src/models/HazardAlert.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { PostEventReport } from '../../src/models/PostEventReport.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC04 E1 - invalid report parameters (DMS-159, contract §14.3): the range is
// outside the event period, starts after it ends, or the districts don't fit
// the event. Every case is refused and nothing is stored; the officer resumes
// at step 4.
const { ObjectId } = mongoose.Types;

let areas;
let kelani;
let officer;

beforeEach(async () => {
  areas = await seedAreas();
  officer = await createUser({ role: Role.DMC_OFFICER });
  kelani = await HazardEvent.create({
    name: 'Kelani basin floods',
    hazardType: 'FLOOD',
    status: 'CLOSED',
    startDate: new Date('2026-06-08'),
    endDate: new Date('2026-06-20'),
    districts: [areas.colombo._id, areas.gampaha._id],
  });
  // An alert on 9 Jun, so a report over that day has something in it.
  await HazardAlert.create({
    referenceNo: 'HA-0001',
    hazardType: 'FLOOD',
    severity: 'HIGH',
    status: 'BROADCAST',
    targets: [{ kind: 'District', area: areas.colombo._id }],
    event: kelani._id,
    createdBy: officer._id,
    statusHistory: [
      {
        status: 'BROADCAST',
        version: 1,
        at: new Date('2026-06-09T09:00:00+05:30'),
        by: officer._id,
      },
    ],
  });
});

const body = (fields = {}) => ({
  eventId: String(kelani._id),
  from: '2026-06-08',
  to: '2026-06-20',
  districtIds: [String(areas.colombo._id), String(areas.gampaha._id)],
  sections: ['alertTimeline'],
  ...fields,
});

const generate = (fields) =>
  request(app)
    .post('/api/post-event-reports')
    .set('Authorization', bearerFor(officer))
    .send(body(fields));

const expectRefused = async (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.body.success).toBe(false);
  expect(res.body.error.code).toBe(code);
  expect(await PostEventReport.countDocuments()).toBe(0);
};

describe('POST /api/post-event-reports — E1 invalid parameters', () => {
  it('TC-35 E1: a start after the end is 400 on from, and nothing is stored', async () => {
    const res = await generate({ from: '2026-06-15', to: '2026-06-12' });

    await expectRefused(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([{ field: 'from', message: 'must not be after to' }]);
  });

  it('TC-36 E1: a start before the event began is 400 on from, naming the start date', async () => {
    const res = await generate({ from: '2026-06-07' });

    await expectRefused(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([
      { field: 'from', message: 'must be on or after the event start date 2026-06-08' },
    ]);
  });

  it('TC-36 E1: an end after the event ended is 400 on to, naming the end date', async () => {
    const res = await generate({ to: '2026-06-21' });

    await expectRefused(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([
      { field: 'to', message: 'must be on or before the event end date 2026-06-20' },
    ]);
  });

  it('TC-36 E1: every field with a problem gets its own entry', async () => {
    const res = await generate({
      from: '2026-06-25',
      to: '2026-06-22',
      districtIds: [String(areas.kalutara._id)],
    });

    await expectRefused(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.errors.map((error) => error.field)).toEqual([
      'from',
      'to',
      'districtIds',
    ]);
  });

  it('TC-37 E1: a single day, from = to, is a valid range (201)', async () => {
    const res = await generate({ from: '2026-06-09', to: '2026-06-09' });

    expect(res.status).toBe(201);
    expect(res.body.data.report).toEqual(
      expect.objectContaining({ dateFrom: '2026-06-09', dateTo: '2026-06-09' }),
    );
  });

  it('TC-38 E1: no district at all is 400 on districtIds', async () => {
    const res = await generate({ districtIds: [] });

    await expectRefused(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([
      { field: 'districtIds', message: 'must select at least one district' },
    ]);
  });

  it('TC-38 E1: a district the event did not affect is 400 on districtIds', async () => {
    const res = await generate({
      districtIds: [String(areas.colombo._id), String(areas.kalutara._id)],
    });

    await expectRefused(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([
      { field: 'districtIds', message: 'must be a district the event affected' },
    ]);
  });

  it('TC-39 E1: an ACTIVE event is 409 EVENT_NOT_CLOSED, naming its status', async () => {
    const active = await HazardEvent.create({
      name: 'Flood – Gampaha District',
      hazardType: 'FLOOD',
      status: 'ACTIVE',
      startDate: new Date('2026-09-25'),
      districts: [areas.gampaha._id],
    });

    const res = await generate({
      eventId: String(active._id),
      from: '2026-09-25',
      to: '2026-09-30',
      districtIds: [String(areas.gampaha._id)],
    });

    await expectRefused(res, 409, 'EVENT_NOT_CLOSED');
    expect(res.body.error.message).toBe(
      'A report can only be generated for a CLOSED event – current status: ACTIVE',
    );
    expect(res.body.error).not.toHaveProperty('errors');
  });

  it('TC-40 E1: an unknown event is 404, before any range check', async () => {
    const res = await generate({
      eventId: String(new ObjectId()),
      from: '2030-01-02',
      to: '2030-01-01',
    });

    await expectRefused(res, 404, 'NOT_FOUND');
  });

  it('TC-40 E1: a malformed event id is 400 on eventId', async () => {
    const res = await generate({ eventId: 'kelani' });

    await expectRefused(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([{ field: 'eventId', message: 'must be a valid id' }]);
  });
});
