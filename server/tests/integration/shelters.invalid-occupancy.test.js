import request from 'supertest';
import { app } from '../../src/core/App.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { Role } from '../../src/enums/Role.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { OccupancyRecord } from '../../src/models/OccupancyRecord.js';
import { Shelter } from '../../src/models/Shelter.js';
import { CoordinationValidator } from '../../src/validators/CoordinationValidator.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC03 E1 (DMS-147): an impossible occupancy is refused with a field error,
// and "No records are changed and the officer is shown the reason".
let officer;
let shelter;

beforeEach(async () => {
  const areas = await seedAreas();
  await HazardEvent.create({
    name: 'Flood – Gampaha District',
    hazardType: 'FLOOD',
    status: EventStatus.ACTIVE,
    startDate: new Date('2026-09-25T00:00:00.000Z'),
    districts: [areas.gampaha._id],
  });
  officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });
  shelter = await Shelter.create({
    district: areas.gampaha._id,
    name: 'Gampaha Central College',
    location: { lat: 7.09, lng: 79.99 },
    capacity: 500,
    currentOccupancy: 460,
  });
});

const patch = (body) =>
  request(app)
    .patch(`/api/shelters/${shelter.id}/occupancy`)
    .set('Authorization', bearerFor(officer))
    .send(body);

const WHOLE_NUMBER = [
  { field: 'occupants', message: 'occupants must be a whole number, 0 or more' },
];

describe('PATCH /api/shelters/:id/occupancy with an invalid value (E1)', () => {
  it.each([
    ['TC-43', -1],
    ['TC-44', 12.5],
    ['TC-45', 'abc'],
    ['TC-45', '12'],
    ['TC-45', null],
  ])('%s: occupants %p is 400 VALIDATION_ERROR on occupants', async (_tc, occupants) => {
    const res = await patch({ occupants });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        errors: WHOLE_NUMBER,
      },
    });
  });

  it('TC-45: a missing occupants is 400, saying it is required', async () => {
    const res = await patch({});

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'occupants', message: 'occupants is required' },
    ]);
  });

  it.each([-1, 12.5, 'abc', undefined])(
    'TC-46: after %p the shelter and its history are unchanged',
    async (occupants) => {
      await patch(occupants === undefined ? {} : { occupants });

      expect((await Shelter.findById(shelter._id)).currentOccupancy).toBe(460);
      expect(await OccupancyRecord.countDocuments()).toBe(0);
    },
  );

  it('E1: 0 is not an error - an empty shelter (TC-14)', async () => {
    const res = await patch({ occupants: 0 });

    expect(res.status).toBe(200);
    expect(await OccupancyRecord.countDocuments()).toBe(1);
  });

  it('E1: the value is checked before the shelter is looked up, so a bad body on an unknown id is 400', async () => {
    const res = await request(app)
      .patch('/api/shelters/66fb0a1b2c3d4e5f6a7b8c99/occupancy')
      .set('Authorization', bearerFor(officer))
      .send({ occupants: -5 });

    expect(res.status).toBe(400);
  });
});

describe('CoordinationValidator.occupancyBody', () => {
  const validate = (body) =>
    CoordinationValidator.occupancyBody.validate(body, { abortEarly: false, stripUnknown: true });

  it.each([0, 1, 460, 100000])('E1: accepts %d', (occupants) => {
    expect(validate({ occupants })).toEqual({ value: { occupants } });
  });

  it.each([-1, 0.5, Infinity, true, [], {}])('E1: refuses %p with one message', (occupants) => {
    const { error } = validate({ occupants });

    expect(error.details).toHaveLength(1);
    expect(error.details[0].message).toBe('"occupants" must be a whole number, 0 or more');
  });

  it('E1: drops unknown fields', () => {
    expect(validate({ occupants: 5, capacity: 9 }).value).toEqual({ occupants: 5 });
  });
});
