import { jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardReport } from '../../src/models/HazardReport.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC02 A3 - a report sent again after a dropped connection is stored once
// (contract §9.2), catalogue TC-23, TC-24, through the real app.
const CLIENT_REPORT_ID = 'b4f0c9e2-6a1d-4c7e-9f3a-2d8e5b7a1c60';

let areas;
let citizen;

beforeAll(async () => {
  await HazardReport.init();
});

beforeEach(async () => {
  areas = await seedAreas();
  citizen = await createUser();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const body = (overrides = {}) => ({
  description: 'Water level rising near the bridge',
  hazardType: 'RISING_RIVER_FLOOD',
  location: { latitude: 6.9382, longitude: 79.9012 },
  locationSource: 'GPS',
  photoUrl: 'https://example.supabase.co/storage/v1/object/public/b/hazard-reports/a.jpg',
  clientReportId: CLIENT_REPORT_ID,
  ...overrides,
});

const submitAs = (user, payload = body()) =>
  request(app).post('/api/hazard-reports').set('Authorization', bearerFor(user)).send(payload);

describe('POST /api/hazard-reports - resend (A3)', () => {
  it('A3 (TC-23): the same clientReportId twice - 201 then 200 with the same report, one stored', async () => {
    const officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });

    const first = await submitAs(citizen);
    const second = await submitAs(citizen);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.report).toEqual(first.body.data.report);
    expect(await HazardReport.countDocuments()).toBe(1);
    expect(await UserNotification.countDocuments({ user: officer._id })).toBe(1);
  });

  it('A3: a resend with a different body still returns the report first stored', async () => {
    const first = await submitAs(citizen);
    expect(first.status).toBe(201);

    const second = await submitAs(citizen, body({ description: 'Edited on the phone' }));

    expect(second.status).toBe(200);
    expect(second.body.data.report.description).toBe(first.body.data.report.description);
  });

  it('A3 (TC-24): two copies at the same moment - exactly one report is stored', async () => {
    const responses = await Promise.all([submitAs(citizen), submitAs(citizen), submitAs(citizen)]);

    expect(responses.map((res) => res.status).sort()).toEqual([200, 200, 201]);
    const ids = new Set(responses.map((res) => res.body.data.report.id));
    expect(ids.size).toBe(1);
    expect(await HazardReport.countDocuments()).toBe(1);
  });

  it('A3: reports without a clientReportId are never treated as resends', async () => {
    await submitAs(citizen, body({ clientReportId: undefined }));
    await submitAs(citizen, body({ clientReportId: undefined }));

    expect(await HazardReport.countDocuments()).toBe(2);
  });

  it("A3: another user's report is never returned for a reused clientReportId - 400", async () => {
    await submitAs(citizen);

    const res = await submitAs(await createUser());

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'clientReportId', message: 'is already used - generate a new one' },
    ]);
    expect(await HazardReport.countDocuments()).toBe(1);
  });

  it('A3: an unrelated storage error still fails the request - 500', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(HazardReport, 'create').mockRejectedValueOnce(new Error('disk full'));

    const res = await submitAs(citizen);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
