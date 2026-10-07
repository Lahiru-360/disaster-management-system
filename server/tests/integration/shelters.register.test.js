import request from 'supertest';
import { app } from '../../src/core/App.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { Role } from '../../src/enums/Role.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { OccupancyRecord } from '../../src/models/OccupancyRecord.js';
import { Shelter } from '../../src/models/Shelter.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC03 A1 (DMS-144): registering a new shelter, from the Manage Shelters
// dialog, in the officer's own district.
let areas;
let officer;

const NEW_SHELTER = {
  name: 'Ja-Ela Central College',
  location: { lat: 7.0744, lng: 79.8919, label: 'Ja-Ela' },
  capacity: 300,
};

const activeEvent = (district) =>
  HazardEvent.create({
    name: `Flood – ${district.name}`,
    hazardType: 'FLOOD',
    status: EventStatus.ACTIVE,
    startDate: new Date('2026-09-25T00:00:00.000Z'),
    districts: [district._id],
  });

beforeAll(async () => {
  await Shelter.init();
});

beforeEach(async () => {
  areas = await seedAreas();
  await activeEvent(areas.gampaha);
  officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });
});

const register = (body, as = officer) =>
  request(app).post('/api/shelters').set('Authorization', bearerFor(as)).send(body);

describe('POST /api/shelters', () => {
  it('TC-30: A1 registers the shelter in the officer’s district, empty and AVAILABLE', async () => {
    const res = await register(NEW_SHELTER);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shelter).toMatchObject({
      name: 'Ja-Ela Central College',
      district: { id: areas.gampaha.id, name: 'Gampaha' },
      location: { lat: 7.0744, lng: 79.8919, label: 'Ja-Ela' },
      capacity: 300,
      currentOccupancy: 0,
      rate: 0,
      status: 'AVAILABLE',
      redirectingTo: null,
    });
    const saved = await Shelter.findById(res.body.data.shelter.id);
    expect(saved.currentOccupancy).toBe(0);
    expect(String(saved.district)).toBe(areas.gampaha.id);
  });

  it('A1.3: the new shelter is on the dashboard list (step 2)', async () => {
    await register(NEW_SHELTER);

    const res = await request(app).get('/api/shelters').set('Authorization', bearerFor(officer));

    expect(res.body.data.shelters.map((s) => s.name)).toEqual(['Ja-Ela Central College']);
  });

  it('keeps the name trimmed and the label optional', async () => {
    const res = await register({
      name: '  Ragama Hall  ',
      location: { lat: 7.03, lng: 79.92 },
      capacity: 120,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.shelter.name).toBe('Ragama Hall');
    expect(res.body.data.shelter.location).toEqual({ lat: 7.03, lng: 79.92, label: null });
  });

  it('puts the shelter in the officer’s own district even when the body names another', async () => {
    const res = await register({ ...NEW_SHELTER, district: areas.colombo.id });

    expect(res.status).toBe(201);
    expect(res.body.data.shelter.district.name).toBe('Gampaha');
  });

  it('ignores a currentOccupancy in the body: a new shelter is always empty', async () => {
    const res = await register({ ...NEW_SHELTER, currentOccupancy: 250 });

    expect(res.body.data.shelter.currentOccupancy).toBe(0);
  });

  it('creates no occupancy record: only an occupancy update writes one', async () => {
    await register(NEW_SHELTER);

    expect(await OccupancyRecord.countDocuments()).toBe(0);
  });

  it.each([
    ['TC-31', 0],
    ['TC-31', -5],
    ['TC-31', 10.5],
    ['TC-31', '300'],
    ['TC-31', null],
  ])(
    '%s: capacity %p is 400 VALIDATION_ERROR on capacity, and nothing is created',
    async (_tc, capacity) => {
      const res = await register({ ...NEW_SHELTER, capacity });

      expect(res.status).toBe(400);
      expect(res.body.error).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        errors: [{ field: 'capacity', message: 'must be a whole number, 1 or more' }],
      });
      expect(await Shelter.countDocuments()).toBe(0);
    },
  );

  it('a missing capacity is 400, saying it is required', async () => {
    const res = await register({ ...NEW_SHELTER, capacity: undefined });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([{ field: 'capacity', message: 'is required' }]);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
    ['not text', 42],
    ['too long', 'x'.repeat(101)],
  ])('a %s name is 400 on name', async (_why, name) => {
    const res = await register({ ...NEW_SHELTER, name });

    expect(res.status).toBe(400);
    expect(res.body.error.errors.map((e) => e.field)).toEqual(['name']);
    expect(await Shelter.countDocuments()).toBe(0);
  });

  it('a name of exactly 100 characters is accepted', async () => {
    const res = await register({ ...NEW_SHELTER, name: 'x'.repeat(100) });

    expect(res.status).toBe(201);
  });

  it.each([
    ['missing', undefined],
    ['not an object', 'Ja-Ela'],
    ['latitude too high', { lat: 91, lng: 79.9 }],
    ['latitude too low', { lat: -91, lng: 79.9 }],
    ['longitude too high', { lat: 7, lng: 181 }],
    ['longitude too low', { lat: 7, lng: -181 }],
    ['lat not a number', { lat: '7.0', lng: 79.9 }],
    ['lng missing', { lat: 7 }],
    ['label not text', { lat: 7, lng: 79.9, label: 12 }],
    ['label too long', { lat: 7, lng: 79.9, label: 'x'.repeat(201) }],
  ])('a location that is %s is 400 on location, never on location.lat', async (_why, location) => {
    const res = await register({ ...NEW_SHELTER, location });

    expect(res.status).toBe(400);
    expect(res.body.error.errors.map((e) => e.field)).toEqual(['location']);
  });

  it('accepts the coordinates on their boundaries, and a 200-character label', async () => {
    const res = await register({
      ...NEW_SHELTER,
      location: { lat: 90, lng: -180, label: 'x'.repeat(200) },
    });

    expect(res.status).toBe(201);
  });

  it('reports every invalid field at once', async () => {
    const res = await register({ name: '', location: null, capacity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.errors.map((e) => e.field).sort()).toEqual([
      'capacity',
      'location',
      'name',
    ]);
  });

  it.each([
    ['TC-32', 'the same name', 'Ja-Ela Central College'],
    ['TC-32', 'a different case', 'ja-ela CENTRAL college'],
    ['TC-32', 'surrounding spaces', '   Ja-Ela Central College  '],
  ])('%s: %s in the same district is 409 SHELTER_NAME_TAKEN', async (_tc, _why, name) => {
    await register(NEW_SHELTER);

    const res = await register({ ...NEW_SHELTER, name });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'SHELTER_NAME_TAKEN',
        message: `A shelter named "${name.trim()}" already exists in Gampaha.`,
      },
    });
    expect(await Shelter.countDocuments()).toBe(1);
  });

  it('TC-32: two registrations of the same name at once create one shelter', async () => {
    const [first, second] = await Promise.all([
      register(NEW_SHELTER),
      register({ ...NEW_SHELTER, name: 'JA-ELA CENTRAL COLLEGE' }),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await Shelter.countDocuments()).toBe(1);
  });

  it('TC-33: the same name in another district is allowed', async () => {
    await activeEvent(areas.colombo);
    const colomboOfficer = await createUser({
      role: Role.DISTRICT_OFFICER,
      district: areas.colombo,
    });
    await register(NEW_SHELTER);

    const res = await register(NEW_SHELTER, colomboOfficer);

    expect(res.status).toBe(201);
    expect(res.body.data.shelter.district.name).toBe('Colombo');
    expect(await Shelter.countDocuments()).toBe(2);
  });

  it('409 NO_ACTIVE_INCIDENT when the district has no active incident, and nothing is created', async () => {
    await HazardEvent.deleteMany({});

    const res = await register(NEW_SHELTER);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_ACTIVE_INCIDENT');
    expect(await Shelter.countDocuments()).toBe(0);
  });

  it('403 FORBIDDEN for a DMC officer, who only reads', async () => {
    const dmc = await createUser({ role: Role.DMC_OFFICER });

    const res = await register(NEW_SHELTER, dmc);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await Shelter.countDocuments()).toBe(0);
  });

  it('403 FORBIDDEN for a district officer with no district on their account', async () => {
    const homeless = await createUser({ role: Role.DISTRICT_OFFICER });

    const res = await register(NEW_SHELTER, homeless);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('No district is assigned to your account.');
  });

  it('401 without a token', async () => {
    const res = await request(app).post('/api/shelters').send(NEW_SHELTER);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_HEADER_MISSING');
  });
});
