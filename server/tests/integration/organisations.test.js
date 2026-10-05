import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { env } from '../../src/config/Config.js';
import { app } from '../../src/core/App.js';
import { OrgType } from '../../src/enums/OrgType.js';
import { Role } from '../../src/enums/Role.js';
import { Organisation } from '../../src/models/Organisation.js';
import { User } from '../../src/models/User.js';

// Every role can read the organisations, so tests sign in as whichever they
// need; the account is created directly, as for any seeded role, and numbered
// so a test that signs in more than once gets a fresh one each time.
let userCount = 0;
const createUser = (role = Role.DMC_OFFICER) =>
  User.create({
    name: `Test ${role}`,
    email: `${role}.${(userCount += 1)}@orgs.test`,
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

// Inserted out of name order, so the tests show the endpoint sorts.
const seedOrganisations = () =>
  Organisation.create([
    { name: 'UNICEF Sri Lanka', type: OrgType.DONOR, contactEmail: 'contact@unicef.example.test' },
    { name: 'SL Army', type: OrgType.ARMED_FORCES },
    { name: 'Red Cross Sri Lanka', type: OrgType.NGO },
    { name: 'ADRA', type: OrgType.NGO },
  ]);

const names = (res) => res.body.data.organisations.map((organisation) => organisation.name);

describe('GET /api/organisations', () => {
  it('DMS-107: lists every organisation sorted by name, in the contract §10 shape', async () => {
    await seedOrganisations();

    const res = await get('/api/organisations');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(names(res)).toEqual(['ADRA', 'Red Cross Sri Lanka', 'SL Army', 'UNICEF Sri Lanka']);
    expect(res.body.data.organisations[0]).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      name: 'ADRA',
      type: 'NGO',
      contactEmail: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(res.body.data.organisations[3].contactEmail).toBe('contact@unicef.example.test');
  });

  it('DMS-107: returns an empty list, not 404, when there are none', async () => {
    const res = await get('/api/organisations');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { organisations: [] } });
  });

  it('DMS-107: type lists only organisations of that type', async () => {
    await seedOrganisations();

    expect(names(await get('/api/organisations?type=NGO'))).toEqual([
      'ADRA',
      'Red Cross Sri Lanka',
    ]);
    expect(names(await get('/api/organisations?type=POLICE'))).toEqual([]);
  });

  it('DMS-107: refuses an unknown type with 400 VALIDATION_ERROR on type', async () => {
    const res = await get('/api/organisations?type=CHARITY');

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      errors: [
        {
          field: 'type',
          message: expect.stringContaining(
            'must be one of [GOVERNMENT, ARMED_FORCES, POLICE, NGO, DONOR]',
          ),
        },
      ],
    });
  });

  it.each(Object.values(Role))('DMS-107: admits a %s', async (role) => {
    await seedOrganisations();

    const res = await get('/api/organisations', role);

    expect(res.status).toBe(200);
    expect(res.body.data.organisations).toHaveLength(4);
  });

  it('DMS-107: refuses a request with no token with 401 AUTH_HEADER_MISSING', async () => {
    const res = await request(app).get('/api/organisations');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_HEADER_MISSING');
  });

  it('DMS-107: refuses a tampered token with 401 TOKEN_INVALID', async () => {
    const res = await request(app)
      .get('/api/organisations')
      .set('Authorization', 'Bearer not-a-valid-jwt');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
});
