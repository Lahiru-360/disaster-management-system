import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { env } from '../../src/config/Config.js';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { District } from '../../src/models/District.js';
import { RiverBasin } from '../../src/models/RiverBasin.js';
import { User } from '../../src/models/User.js';

// Every role can read the geography, so tests sign in as whichever they need;
// the account is created directly, as for any seeded role.
const createUser = (role = Role.CITIZEN) =>
  User.create({ name: `Test ${role}`, email: `${role}@areas.test`, passwordHash: 'unused', role });

const bearerFor = (user, expiresIn = '15m') =>
  `Bearer ${jwt.sign({ id: user.id, role: user.role }, env.jwtAccessSecret, { expiresIn })}`;

afterEach(() => {
  jest.restoreAllMocks();
});

const box = (minLat, maxLat, minLng, maxLng) => ({ minLat, maxLat, minLng, maxLng });

// Inserted out of name order, so the tests show the endpoints sort.
const seedAreas = async () => {
  const kalutara = await District.create({
    name: 'Kalutara',
    province: 'Western',
    centroid: { lat: 6.5854, lng: 79.9607 },
    bounds: box(6.27, 6.76, 79.88, 80.35),
  });
  const gampaha = await District.create({
    name: 'Gampaha',
    province: 'Western',
    centroid: { lat: 7.0917, lng: 79.9999 },
    bounds: box(6.98, 7.33, 79.82, 80.26),
  });
  const colombo = await District.create({
    name: 'Colombo',
    province: 'Western',
    centroid: { lat: 6.9271, lng: 79.8612 },
    bounds: box(6.75, 6.98, 79.83, 80.22),
  });
  await RiverBasin.create({ name: 'Kelani', districts: [gampaha._id, colombo._id] });
  await RiverBasin.create({ name: 'Kalu', districts: [kalutara._id] });
  return { colombo, gampaha, kalutara };
};

describe.each([
  ['/api/districts', 'districts'],
  ['/api/river-basins', 'riverBasins'],
])('GET %s', (path, key) => {
  it('DMS-104: returns an empty list, not 404, when nothing is registered', async () => {
    const res = await request(app)
      .get(path)
      .set('Authorization', bearerFor(await createUser()));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { [key]: [] } });
  });

  it.each(Object.values(Role))('DMS-104: admits a %s', async (role) => {
    await seedAreas();

    const res = await request(app)
      .get(path)
      .set('Authorization', bearerFor(await createUser(role)));

    expect(res.status).toBe(200);
    expect(res.body.data[key].length).toBeGreaterThan(0);
  });

  it('DMS-104: refuses a request with no token with 401 AUTH_HEADER_MISSING', async () => {
    const res = await request(app).get(path);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'AUTH_HEADER_MISSING', message: 'Authorization header is missing.' },
    });
  });

  it('DMS-104: refuses a header that is not Bearer with 401 AUTH_HEADER_MALFORMED', async () => {
    const res = await request(app).get(path).set('Authorization', 'Token abc');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_HEADER_MALFORMED');
  });

  it('DMS-104: refuses a tampered token with 401 TOKEN_INVALID', async () => {
    const res = await request(app).get(path).set('Authorization', 'Bearer not-a-valid-jwt');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('DMS-104: refuses an expired token with 401 TOKEN_EXPIRED', async () => {
    const res = await request(app)
      .get(path)
      .set('Authorization', bearerFor(await createUser(), -10));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('GET /api/districts', () => {
  it('DMS-104: lists every district sorted by name, in the contract §7 shape', async () => {
    const { colombo } = await seedAreas();

    const res = await request(app)
      .get('/api/districts')
      .set('Authorization', bearerFor(await createUser()));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { districts } = res.body.data;
    expect(districts.map((district) => district.name)).toEqual(['Colombo', 'Gampaha', 'Kalutara']);
    expect(districts[0]).toEqual({
      id: String(colombo._id),
      name: 'Colombo',
      province: 'Western',
      centroid: { lat: 6.9271, lng: 79.8612 },
      bounds: { minLat: 6.75, maxLat: 6.98, minLng: 79.83, maxLng: 80.22 },
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('DMS-104: ignores query parameters it does not take', async () => {
    await seedAreas();

    const res = await request(app)
      .get('/api/districts?province=Central')
      .set('Authorization', bearerFor(await createUser()));

    expect(res.status).toBe(200);
    expect(res.body.data.districts).toHaveLength(3);
  });

  it('DMS-104: surfaces a database failure as 500 INTERNAL_ERROR', async () => {
    jest.spyOn(District, 'find').mockImplementationOnce(() => {
      throw new Error('database unreachable');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .get('/api/districts')
      .set('Authorization', bearerFor(await createUser()));

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('database unreachable');
  });
});

describe('GET /api/river-basins', () => {
  it('DMS-104: lists every basin sorted by name, with its districts as { id, name } sorted by name', async () => {
    const { colombo, gampaha } = await seedAreas();

    const res = await request(app)
      .get('/api/river-basins')
      .set('Authorization', bearerFor(await createUser()));

    expect(res.status).toBe(200);
    const { riverBasins } = res.body.data;
    expect(riverBasins.map((basin) => basin.name)).toEqual(['Kalu', 'Kelani']);
    expect(riverBasins[1]).toEqual({
      id: expect.any(String),
      name: 'Kelani',
      districts: [
        { id: String(colombo._id), name: 'Colombo' },
        { id: String(gampaha._id), name: 'Gampaha' },
      ],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/"_id"|"__v"/);
  });
});

describe('Areas routes mounted at /api', () => {
  it('DMS-104: leave other /api paths to their own routes and to the 404 handler', async () => {
    const res = await request(app)
      .get('/api/no-such-resource')
      .set('Authorization', bearerFor(await createUser()));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('DMS-104: do not accept writes to the read-only area lists', async () => {
    const res = await request(app)
      .post('/api/districts')
      .set('Authorization', bearerFor(await createUser()))
      .send({ name: 'New' });

    expect(res.status).toBe(404);
  });
});
