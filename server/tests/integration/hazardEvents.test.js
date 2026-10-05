import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { env } from '../../src/config/Config.js';
import { app } from '../../src/core/App.js';
import { AlertHazardType } from '../../src/enums/AlertHazardType.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { Role } from '../../src/enums/Role.js';
import { District } from '../../src/models/District.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { User } from '../../src/models/User.js';

// Every role can read the events, so tests sign in as whichever they need; the
// account is created directly, as for any seeded role, and numbered so a test
// that signs in more than once gets a fresh one each time.
let userCount = 0;
const createUser = (role = Role.DMC_OFFICER) =>
  User.create({
    name: `Test ${role}`,
    email: `${role}.${(userCount += 1)}@events.test`,
    passwordHash: 'unused',
    role,
  });

const bearerFor = (user, expiresIn = '15m') =>
  `Bearer ${jwt.sign({ id: user.id, role: user.role }, env.jwtAccessSecret, { expiresIn })}`;

const get = async (path, role) =>
  request(app)
    .get(path)
    .set('Authorization', bearerFor(await createUser(role)));

afterEach(() => {
  jest.restoreAllMocks();
});

const district = (name) =>
  District.create({
    name,
    province: 'Western',
    centroid: { lat: 7, lng: 80 },
    bounds: { minLat: 6, maxLat: 8, minLng: 79, maxLng: 81 },
  });

// The two seeded events plus an older closed one, inserted out of date order
// so the tests show the endpoint sorts. Districts are listed out of name order.
const seedEvents = async () => {
  const gampaha = await district('Gampaha');
  const colombo = await district('Colombo');
  const kalutara = await district('Kalutara');
  const galle = await district('Galle');
  const kelani = await HazardEvent.create({
    name: 'Kelani basin floods',
    hazardType: AlertHazardType.FLOOD,
    status: EventStatus.CLOSED,
    startDate: new Date('2026-06-08'),
    endDate: new Date('2026-06-20'),
    districts: [kalutara._id, gampaha._id, colombo._id],
  });
  const active = await HazardEvent.create({
    name: 'Flood – Gampaha District',
    hazardType: AlertHazardType.FLOOD,
    status: EventStatus.ACTIVE,
    startDate: new Date('2026-09-25'),
    districts: [gampaha._id],
  });
  await HazardEvent.create({
    name: 'Galle landslides',
    hazardType: AlertHazardType.LANDSLIDE,
    status: EventStatus.CLOSED,
    startDate: new Date('2026-02-01'),
    endDate: new Date('2026-02-03'),
    districts: [galle._id],
  });
  return { kelani, active, colombo, gampaha, kalutara, galle };
};

const names = (res) => res.body.data.hazardEvents.map((event) => event.name);

describe('GET /api/hazard-events', () => {
  it('DMS-107: lists every event, most recent start first, in the contract §8 shape', async () => {
    const { kelani, colombo, gampaha, kalutara } = await seedEvents();

    const res = await get('/api/hazard-events');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(names(res)).toEqual([
      'Flood – Gampaha District',
      'Kelani basin floods',
      'Galle landslides',
    ]);
    expect(res.body.data.hazardEvents[1]).toEqual({
      id: String(kelani._id),
      name: 'Kelani basin floods',
      hazardType: 'FLOOD',
      status: 'CLOSED',
      startDate: '2026-06-08T00:00:00.000Z',
      endDate: '2026-06-20T00:00:00.000Z',
      districts: [
        { id: String(colombo._id), name: 'Colombo' },
        { id: String(gampaha._id), name: 'Gampaha' },
        { id: String(kalutara._id), name: 'Kalutara' },
      ],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(res.body.data.hazardEvents[0].endDate).toBeNull();
  });

  it('DMS-107: returns an empty list, not 404, when there are no events', async () => {
    const res = await get('/api/hazard-events');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { hazardEvents: [] } });
  });

  it.each([
    ['ACTIVE', ['Flood – Gampaha District']],
    ['CLOSED', ['Kelani basin floods', 'Galle landslides']],
  ])('DMS-107: status=%s lists only those events', async (status, expected) => {
    await seedEvents();

    const res = await get(`/api/hazard-events?status=${status}`);

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(expected);
  });

  it('DMS-107: districtId lists the events affecting that district', async () => {
    const { gampaha, colombo } = await seedEvents();

    expect(names(await get(`/api/hazard-events?districtId=${gampaha._id}`))).toEqual([
      'Flood – Gampaha District',
      'Kelani basin floods',
    ]);
    expect(names(await get(`/api/hazard-events?districtId=${colombo._id}`))).toEqual([
      'Kelani basin floods',
    ]);
  });

  it('DMS-107: status and districtId together find the ACTIVE event for a district', async () => {
    const { gampaha, colombo } = await seedEvents();

    expect(names(await get(`/api/hazard-events?status=ACTIVE&districtId=${gampaha._id}`))).toEqual([
      'Flood – Gampaha District',
    ]);
    expect(names(await get(`/api/hazard-events?status=ACTIVE&districtId=${colombo._id}`))).toEqual(
      [],
    );
  });

  it('DMS-107: a well-formed but unknown districtId returns an empty list', async () => {
    await seedEvents();

    const res = await get('/api/hazard-events?districtId=66f7c1a2b3c4d5e6f7a8b999');

    expect(res.status).toBe(200);
    expect(res.body.data.hazardEvents).toEqual([]);
  });

  it('DMS-107: refuses an unknown status with 400 VALIDATION_ERROR on status', async () => {
    const res = await get('/api/hazard-events?status=OPEN');

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      errors: [
        { field: 'status', message: expect.stringContaining('must be one of [ACTIVE, CLOSED]') },
      ],
    });
  });

  it.each(['gampaha', '66f7c1a2b3c4d5e6f7a8b9', '66f7c1a2b3c4d5e6f7a8b9zz'])(
    'DMS-107: refuses a malformed districtId (%s) with 400 VALIDATION_ERROR',
    async (districtId) => {
      const res = await get(`/api/hazard-events?districtId=${districtId}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.errors.map((error) => error.field)).toContain('districtId');
    },
  );

  it.each(Object.values(Role))('DMS-107: admits a %s', async (role) => {
    await seedEvents();

    const res = await get('/api/hazard-events', role);

    expect(res.status).toBe(200);
    expect(res.body.data.hazardEvents).toHaveLength(3);
  });

  it('DMS-107: refuses a request with no token with 401 AUTH_HEADER_MISSING', async () => {
    const res = await request(app).get('/api/hazard-events');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_HEADER_MISSING');
  });

  it('DMS-107: refuses an expired token with 401 TOKEN_EXPIRED', async () => {
    const res = await request(app)
      .get('/api/hazard-events')
      .set('Authorization', bearerFor(await createUser(), -10));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });
});
