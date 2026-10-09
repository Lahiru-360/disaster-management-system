import request from 'supertest';
import { app } from '../../src/core/App.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { Role } from '../../src/enums/Role.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { OccupancyRecord } from '../../src/models/OccupancyRecord.js';
import { Shelter } from '../../src/models/Shelter.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor, expiredBearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

let areas;
let officer;
let shelter;

beforeEach(async () => {
  areas = await seedAreas();
  await HazardEvent.create({
    name: 'Flood – Gampaha District',
    hazardType: 'FLOOD',
    status: EventStatus.ACTIVE,
    startDate: new Date('2026-09-25T00:00:00.000Z'),
    districts: [areas.gampaha._id],
  });
  officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });
  // Capacity 100, so occupants are the percentage.
  shelter = await Shelter.create({
    district: areas.gampaha._id,
    name: 'Gampaha Central College',
    location: { lat: 7.09, lng: 79.99 },
    capacity: 100,
    currentOccupancy: 50,
  });
});

const patch = (id, body, user = officer) =>
  request(app)
    .patch(`/api/shelters/${id}/occupancy`)
    .set('Authorization', bearerFor(user))
    .send(body);

describe('PATCH /api/shelters/:id/occupancy', () => {
  it('TC-07: Main 3-4 sets the occupancy and creates an occupancy record', async () => {
    const res = await patch(shelter.id, { occupants: 60 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shelter).toMatchObject({
      id: shelter.id,
      name: 'Gampaha Central College',
      district: { id: areas.gampaha.id, name: 'Gampaha' },
      capacity: 100,
      currentOccupancy: 60,
    });
    expect((await Shelter.findById(shelter._id)).currentOccupancy).toBe(60);

    const records = await OccupancyRecord.find({ shelter: shelter._id });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ occupants: 60, capacity: 100 });
    expect(String(records[0].district)).toBe(areas.gampaha.id);
    expect(String(records[0].recordedBy)).toBe(officer.id);
  });

  it.each([
    ['TC-08', 74, 'AVAILABLE', false],
    ['TC-09', 75, 'FILLING_UP', false],
    ['TC-10', 89, 'FILLING_UP', false],
    ['TC-11', 90, 'NEAR_CAPACITY', true],
    ['TC-12', 99, 'NEAR_CAPACITY', true],
    ['TC-13', 100, 'FULL', true],
    ['TC-13', 101, 'FULL', true],
  ])('%s: Main 5 %d% is %s (flagged: %s)', async (_tc, occupants, status, flagged) => {
    const res = await patch(shelter.id, { occupants });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      rate: occupants / 100,
      status,
      flagged,
      shelter: { status, rate: occupants / 100 },
    });
  });

  it('TC-14: Main 3 0 occupants is AVAILABLE at 0%', async () => {
    const res = await patch(shelter.id, { occupants: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ rate: 0, status: 'AVAILABLE', flagged: false });
    expect(await OccupancyRecord.countDocuments({ occupants: 0 })).toBe(1);
  });

  it('Main 4: the history keeps one record per update, oldest first by time', async () => {
    await patch(shelter.id, { occupants: 70 });
    await patch(shelter.id, { occupants: 80 });

    const records = await OccupancyRecord.find({ shelter: shelter._id }).sort({
      recordedAt: 1,
      _id: 1,
    });
    expect(records.map((r) => r.occupants)).toEqual([70, 80]);
  });

  it('TC-29: a district officer from another district gets 403 and nothing changes', async () => {
    const other = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.colombo });

    const res = await patch(shelter.id, { occupants: 60 }, other);

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'You can only coordinate your own district.',
    });
    expect((await Shelter.findById(shelter._id)).currentOccupancy).toBe(50);
    expect(await OccupancyRecord.countDocuments()).toBe(0);
  });

  it.each([Role.DMC_OFFICER, Role.DUTY_OFFICER, Role.CITIZEN, Role.RESCUE_TEAM_LEAD])(
    'Main 3: a %s may not update occupancy (403)',
    async (role) => {
      const user = await createUser({ role });

      expect((await patch(shelter.id, { occupants: 60 }, user)).status).toBe(403);
    },
  );

  it('Main 3: no ACTIVE incident is 409 NO_ACTIVE_INCIDENT and nothing changes', async () => {
    await HazardEvent.deleteMany({});

    const res = await patch(shelter.id, { occupants: 60 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_ACTIVE_INCIDENT');
    expect((await Shelter.findById(shelter._id)).currentOccupancy).toBe(50);
    expect(await OccupancyRecord.countDocuments()).toBe(0);
  });

  it('Main 3: an unknown or malformed shelter id is 404', async () => {
    expect((await patch('66fb0a1b2c3d4e5f6a7b8c99', { occupants: 1 })).status).toBe(404);
    expect((await patch('nope', { occupants: 1 })).status).toBe(404);
  });

  it('Main 3: no token or an expired one is 401', async () => {
    const none = await request(app)
      .patch(`/api/shelters/${shelter.id}/occupancy`)
      .send({ occupants: 1 });
    const expired = await request(app)
      .patch(`/api/shelters/${shelter.id}/occupancy`)
      .set('Authorization', expiredBearerFor(officer))
      .send({ occupants: 1 });

    expect(none.body.error.code).toBe('AUTH_HEADER_MISSING');
    expect(expired.body.error.code).toBe('TOKEN_EXPIRED');
  });
});
