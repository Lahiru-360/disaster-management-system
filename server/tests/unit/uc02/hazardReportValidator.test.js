import express from 'express';
import request from 'supertest';
import { SRI_LANKA_BOUNDS, isInsideSriLanka } from '../../../src/constants/geo.js';
import { ErrorHandler } from '../../../src/middleware/ErrorHandler.js';
import { RequestValidator } from '../../../src/middleware/RequestValidator.js';
import { HazardReportValidator } from '../../../src/validators/HazardReportValidator.js';

// UC02 E1 (catalogue TC-31…TC-37). The submit route arrives in DMS-130.7, so
// this drives the schema through the real RequestValidator and ErrorHandler on
// a throwaway route: the 400 envelope asserted here is the one the app gets.
const probe = express();
probe.use(express.json());
probe.post('/probe', RequestValidator.body(HazardReportValidator.submitSchema), (req, res) => {
  res.status(201).json({ body: req.body });
});
probe.use(ErrorHandler.handle);

const validReport = (overrides = {}) => ({
  description: 'Water level rising near the bridge',
  hazardType: 'RISING_RIVER_FLOOD',
  location: { latitude: 6.9382, longitude: 79.9012 },
  locationSource: 'GPS',
  photoUrl: 'https://example.supabase.co/storage/v1/object/public/b/hazard-reports/a.jpg',
  ...overrides,
});

const without = (field) => {
  const report = validReport();
  delete report[field];
  return report;
};

const submit = (body) => request(probe).post('/probe').send(body);

const expectFieldErrors = (res, expected) => {
  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.errors).toEqual(expected);
};

describe('HazardReportValidator.submitSchema (UC02 E1)', () => {
  it('Main 6: accepts a valid report and passes it on validated', async () => {
    const res = await submit(
      validReport({ clientReportId: 'b4f0c9e2-6a1d-4c7e-9f3a-2d8e5b7a1c60' }),
    );

    expect(res.status).toBe(201);
    expect(res.body.body).toEqual(
      validReport({ clientReportId: 'b4f0c9e2-6a1d-4c7e-9f3a-2d8e5b7a1c60' }),
    );
  });

  it('Main 6: trims the description and drops unknown fields', async () => {
    const res = await submit(
      validReport({
        description: '  Road blocked by a fallen tree  ',
        location: { latitude: 6.9, longitude: 79.9, accuracy: 12 },
        status: 'CONFIRMED',
      }),
    );

    expect(res.status).toBe(201);
    expect(res.body.body.description).toBe('Road blocked by a fallen tree');
    expect(res.body.body.location).toEqual({ latitude: 6.9, longitude: 79.9 });
    expect(res.body.body).not.toHaveProperty('status');
  });

  it('E1 (TC-31): rejects a missing photoUrl on field photoUrl', async () => {
    expectFieldErrors(await submit(without('photoUrl')), [
      { field: 'photoUrl', message: 'is required' },
    ]);
  });

  it.each(['', 'not a url', 'ftp://example.test/a.jpg'])(
    'E1 (TC-31): rejects photoUrl %j as not a URL',
    async (photoUrl) => {
      const res = await submit(validReport({ photoUrl }));

      expect(res.status).toBe(400);
      expect(res.body.error.errors.map((e) => e.field)).toEqual(['photoUrl']);
    },
  );

  it('E1 (TC-32): rejects a missing hazardType on field hazardType', async () => {
    expectFieldErrors(await submit(without('hazardType')), [
      { field: 'hazardType', message: 'is required' },
    ]);
  });

  it.each(['FLOOD', 'landslide', 42])(
    'E1 (TC-32): rejects hazardType %j outside ReportHazardType',
    async (hazardType) => {
      expectFieldErrors(await submit(validReport({ hazardType })), [
        {
          field: 'hazardType',
          message: 'must be one of [RISING_RIVER_FLOOD, LANDSLIDE, BLOCKED_ROAD, OTHER]',
        },
      ]);
    },
  );

  it('E1 (TC-33): rejects a missing location on field location', async () => {
    expectFieldErrors(await submit(without('location')), [
      { field: 'location', message: 'is required' },
    ]);
  });

  it.each([
    ['a missing latitude', { longitude: 79.9 }],
    ['a string latitude', { latitude: '6.9', longitude: 79.9 }],
    ['a null longitude', { latitude: 6.9, longitude: null }],
    ['a plain string', 'Colombo'],
    ['null', null],
  ])('E1 (TC-33): reports %s on the top-level location field', async (_label, location) => {
    expectFieldErrors(await submit(validReport({ location })), [
      { field: 'location', message: 'must have a numeric latitude and longitude' },
    ]);
  });

  it('E1 (TC-34): rejects the storyboard Jakarta coordinates as outside Sri Lanka', async () => {
    expectFieldErrors(
      await submit(validReport({ location: { latitude: -6.2088, longitude: 106.8456 } })),
      [{ field: 'location', message: 'must be inside Sri Lanka' }],
    );
  });

  const { minLat, maxLat, minLng, maxLng } = SRI_LANKA_BOUNDS;

  it.each([
    ['south-west corner', minLat, minLng],
    ['north-west corner', maxLat, minLng],
    ['south-east corner', minLat, maxLng],
    ['north-east corner', maxLat, maxLng],
  ])('E1 (TC-35): accepts a point on the %s of the box', async (_label, latitude, longitude) => {
    expect((await submit(validReport({ location: { latitude, longitude } }))).status).toBe(201);
  });

  it.each([
    ['south', minLat - 0.0001, 80.5],
    ['north', maxLat + 0.0001, 80.5],
    ['west', 7.5, minLng - 0.0001],
    ['east', 7.5, maxLng + 0.0001],
  ])('E1 (TC-35): rejects a point just past the %s edge', async (_label, latitude, longitude) => {
    expectFieldErrors(await submit(validReport({ location: { latitude, longitude } })), [
      { field: 'location', message: 'must be inside Sri Lanka' },
    ]);
  });

  it('E1 (TC-36): accepts a 200-character description', async () => {
    expect((await submit(validReport({ description: 'x'.repeat(200) }))).status).toBe(201);
  });

  it('E1 (TC-36): rejects a 201-character description', async () => {
    expectFieldErrors(await submit(validReport({ description: 'x'.repeat(201) })), [
      { field: 'description', message: 'must be at most 200 characters' },
    ]);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['only spaces', '   '],
  ])('E1: rejects a description that is %s', async (_label, description) => {
    expectFieldErrors(await submit(validReport({ description })), [
      { field: 'description', message: 'is required' },
    ]);
  });

  it('E1: rejects a description that is not text', async () => {
    expectFieldErrors(await submit(validReport({ description: 12 })), [
      { field: 'description', message: 'must be text' },
    ]);
  });

  it('E1 (TC-37): returns one error entry per invalid field', async () => {
    const res = await submit({
      description: 'x'.repeat(201),
      hazardType: 'FLOOD',
      location: { latitude: -6.2088, longitude: 106.8456 },
      locationSource: 'GPS',
    });

    expectFieldErrors(res, [
      { field: 'description', message: 'must be at most 200 characters' },
      {
        field: 'hazardType',
        message: 'must be one of [RISING_RIVER_FLOOD, LANDSLIDE, BLOCKED_ROAD, OTHER]',
      },
      { field: 'location', message: 'must be inside Sri Lanka' },
      { field: 'photoUrl', message: 'is required' },
    ]);
  });

  it('A2 (TC-20): accepts locationSource MANUAL', async () => {
    expect((await submit(validReport({ locationSource: 'MANUAL' }))).status).toBe(201);
  });

  it.each([undefined, 'WIFI'])('A2 (TC-21): rejects locationSource %j', async (locationSource) => {
    const res = await submit(validReport({ locationSource }));

    expect(res.status).toBe(400);
    expect(res.body.error.errors.map((e) => e.field)).toEqual(['locationSource']);
  });

  it.each(['abc', 'b4f0c9e2-6a1d-1c7e-9f3a-2d8e5b7a1c60', 42])(
    'A3: rejects clientReportId %j that is not a UUID v4',
    async (clientReportId) => {
      expectFieldErrors(await submit(validReport({ clientReportId })), [
        { field: 'clientReportId', message: 'must be a UUID v4' },
      ]);
    },
  );
});

describe('isInsideSriLanka', () => {
  it('E1: puts Colombo inside and Jakarta outside', () => {
    expect(isInsideSriLanka({ latitude: 6.9271, longitude: 79.8612 })).toBe(true);
    expect(isInsideSriLanka({ latitude: -6.2088, longitude: 106.8456 })).toBe(false);
  });
});
