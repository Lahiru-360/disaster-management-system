import request from 'supertest';
import { app } from '../../src/core/App.js';
import { HazardReport } from '../../src/models/HazardReport.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC02 E1 - an invalid report is rejected with the fields to fix (contract
// §9.2), catalogue TC-31…TC-37, through the real POST /api/hazard-reports
// route. Nothing is ever stored for a rejected report.
let citizen;
let areas;

beforeAll(async () => {
  await HazardReport.init();
});

beforeEach(async () => {
  areas = await seedAreas();
  citizen = await createUser();
});

const validBody = () => ({
  description: 'Water level rising near the bridge',
  hazardType: 'RISING_RIVER_FLOOD',
  location: { latitude: 6.9382, longitude: 79.9012 },
  locationSource: 'GPS',
  photoUrl: 'https://example.supabase.co/storage/v1/object/public/b/hazard-reports/a.jpg',
});

const submit = (body) =>
  request(app).post('/api/hazard-reports').set('Authorization', bearerFor(citizen)).send(body);

const without = (field) => {
  const body = validBody();
  delete body[field];
  return body;
};

const expectRejected = async (res, errors) => {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.errors).toEqual(errors);
  expect(await HazardReport.countDocuments()).toBe(0);
};

describe('POST /api/hazard-reports - validation (E1)', () => {
  it('E1 (TC-31): a missing photoUrl - 400 on photoUrl', async () => {
    await expectRejected(await submit(without('photoUrl')), [
      { field: 'photoUrl', message: 'is required' },
    ]);
  });

  it.each([
    ['missing', undefined, 'is required'],
    ['unknown', 'TSUNAMI', 'must be one of [RISING_RIVER_FLOOD, LANDSLIDE, BLOCKED_ROAD, OTHER]'],
  ])('E1 (TC-32): a %s hazardType - 400 on hazardType', async (_label, hazardType, message) => {
    await expectRejected(await submit({ ...validBody(), hazardType }), [
      { field: 'hazardType', message },
    ]);
  });

  it('E1 (TC-33): a missing location - 400 on location', async () => {
    await expectRejected(await submit(without('location')), [
      { field: 'location', message: 'is required' },
    ]);
  });

  it('E1 (TC-34): the storyboard Jakarta coordinates - 400 on location', async () => {
    await expectRejected(
      await submit({ ...validBody(), location: { latitude: -6.2088, longitude: 106.8456 } }),
      [{ field: 'location', message: 'must be inside Sri Lanka' }],
    );
  });

  it.each([
    ['south-west', 5.85, 79.5],
    ['north-east', 9.9, 81.95],
  ])(
    'E1 (TC-35): a point on the %s corner of the box passes the Sri Lanka check',
    async (_label, latitude, longitude) => {
      const res = await submit({ ...validBody(), location: { latitude, longitude } });

      // Both corners are at sea, beyond every fixture district, and this reporter
      // has no home district - so the only refusal left is the routing one, not
      // "must be inside Sri Lanka".
      await expectRejected(res, [
        { field: 'location', message: 'must be inside a district of Sri Lanka' },
      ]);
    },
  );

  it('E1 (TC-35): a box corner from a reporter with a home district is stored', async () => {
    const reporter = await createUser({ homeDistrict: areas.colombo });

    const res = await request(app)
      .post('/api/hazard-reports')
      .set('Authorization', bearerFor(reporter))
      .send({ ...validBody(), location: { latitude: 5.85, longitude: 79.5 } });

    expect(res.status).toBe(201);
    expect(res.body.data.report.district.name).toBe('Colombo');
  });

  it('E1 (TC-36): a 200-character description is stored', async () => {
    const res = await submit({ ...validBody(), description: 'x'.repeat(200) });

    expect(res.status).toBe(201);
  });

  it('E1 (TC-36): a 201-character description - 400 on description', async () => {
    await expectRejected(await submit({ ...validBody(), description: 'x'.repeat(201) }), [
      { field: 'description', message: 'must be at most 200 characters' },
    ]);
  });

  it('E1 (TC-37): several invalid fields - one error entry per field', async () => {
    await expectRejected(
      await submit({
        description: '',
        hazardType: 'TSUNAMI',
        location: { latitude: -6.2088, longitude: 106.8456 },
        locationSource: 'WIFI',
      }),
      [
        { field: 'description', message: 'is required' },
        {
          field: 'hazardType',
          message: 'must be one of [RISING_RIVER_FLOOD, LANDSLIDE, BLOCKED_ROAD, OTHER]',
        },
        { field: 'location', message: 'must be inside Sri Lanka' },
        { field: 'locationSource', message: 'must be one of [GPS, MANUAL]' },
        { field: 'photoUrl', message: 'is required' },
      ],
    );
  });
});
