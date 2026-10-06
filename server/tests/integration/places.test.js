import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardReport } from '../../src/models/HazardReport.js';
import { Place } from '../../src/models/Place.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC02 A2 - GPS unavailable, set the location by hand (contract §9.2, §9.8),
// catalogue TC-20…TC-22, through the real app.
let areas;
let citizen;

beforeAll(async () => {
  await Place.init();
  await HazardReport.init();
});

beforeEach(async () => {
  areas = await seedAreas();
  citizen = await createUser();
});

const addPlace = (name, district, latitude = 6.93, longitude = 79.9) =>
  Place.create({ name, district: district._id, location: { latitude, longitude } });

const search = (q, user = citizen) => {
  const req = request(app).get('/api/places').set('Authorization', bearerFor(user));
  return q === undefined ? req : req.query({ q });
};

describe('GET /api/places (A2.2 place search)', () => {
  it('A2 (TC-22): finds a place by the start of its name, with its district and location', async () => {
    await addPlace('Kolonnawa', areas.colombo, 6.9329, 79.8848);

    const res = await search('Kolon');

    expect(res.status).toBe(200);
    expect(res.body.data.places).toEqual([
      {
        id: expect.any(String),
        name: 'Kolonnawa',
        district: { id: areas.colombo.id, name: 'Colombo' },
        location: { latitude: 6.9329, longitude: 79.8848 },
      },
    ]);
  });

  it('A2 (TC-22): no match is 200 with an empty list', async () => {
    await addPlace('Kolonnawa', areas.colombo);

    const res = await search('Jaffna');

    expect(res.status).toBe(200);
    expect(res.body.data.places).toEqual([]);
  });

  it('A2: matches case-insensitively and only at the start of the name', async () => {
    await addPlace('Kelaniya', areas.gampaha);
    await addPlace('Peliyagoda', areas.gampaha);

    const res = await search('KEL');

    expect(res.body.data.places.map((p) => p.name)).toEqual(['Kelaniya']);
  });

  it('A2: returns at most 10 places, sorted by name', async () => {
    for (let i = 12; i >= 1; i -= 1) {
      await addPlace(`Town ${String(i).padStart(2, '0')}`, areas.kalutara);
    }

    const res = await search('Town');

    expect(res.body.data.places.map((p) => p.name)).toEqual(
      Array.from({ length: 10 }, (_, i) => `Town ${String(i + 1).padStart(2, '0')}`),
    );
  });

  it('A2: treats the query as text, not a pattern', async () => {
    await addPlace('Kolonnawa', areas.colombo);

    const res = await search('.*');

    expect(res.status).toBe(200);
    expect(res.body.data.places).toEqual([]);
  });

  it.each([
    ['missing', undefined, 'is required'],
    ['one character', 'K', 'must be at least 2 characters'],
    ['over 50 characters', 'K'.repeat(51), 'must be at most 50 characters'],
  ])('A2: q %s is 400 on field q', async (_label, q, message) => {
    const res = await search(q);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([{ field: 'q', message }]);
  });

  it('A2: is open to every signed-in role', async () => {
    await addPlace('Kolonnawa', areas.colombo);

    const res = await search('Kol', await createUser({ role: Role.DUTY_OFFICER }));

    expect(res.status).toBe(200);
  });

  it('A2: needs a token - 401', async () => {
    const res = await request(app).get('/api/places').query({ q: 'Kol' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/hazard-reports with a manual location (A2.3)', () => {
  const body = (overrides = {}) => ({
    description: 'Road blocked by a fallen tree',
    hazardType: 'BLOCKED_ROAD',
    location: { latitude: 6.9329, longitude: 79.8848 },
    locationSource: 'MANUAL',
    photoUrl: 'https://example.supabase.co/storage/v1/object/public/b/hazard-reports/a.jpg',
    ...overrides,
  });
  const submit = (payload) =>
    request(app).post('/api/hazard-reports').set('Authorization', bearerFor(citizen)).send(payload);

  it('A2 (TC-20): stores and returns locationSource MANUAL', async () => {
    const res = await submit(body());

    expect(res.status).toBe(201);
    expect(res.body.data.report.locationSource).toBe('MANUAL');
    expect((await HazardReport.findById(res.body.data.report.id)).locationSource).toBe('MANUAL');
  });

  it.each([undefined, 'WIFI', 'manual'])(
    'A2 (TC-21): locationSource %j is 400 on field locationSource',
    async (locationSource) => {
      const res = await submit(body({ locationSource }));

      expect(res.status).toBe(400);
      expect(res.body.error.errors.map((e) => e.field)).toEqual(['locationSource']);
      expect(await HazardReport.countDocuments()).toBe(0);
    },
  );
});
