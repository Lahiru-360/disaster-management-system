import { jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { NotificationType } from '../../src/enums/NotificationType.js';
import { Role } from '../../src/enums/Role.js';
import { HazardReport } from '../../src/models/HazardReport.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { notificationService } from '../../src/services/NotificationService.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor, expiredBearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// POST /api/hazard-reports - UC02 main flow steps 5-9 (contract §9.2),
// catalogue TC-01…TC-08, through the real app.
const validBody = (overrides = {}) => ({
  description: 'Water level rising near the bridge',
  hazardType: 'RISING_RIVER_FLOOD',
  location: { latitude: 6.9382, longitude: 79.9012 },
  locationSource: 'GPS',
  photoUrl: 'https://example.supabase.co/storage/v1/object/public/b/hazard-reports/a.jpg',
  ...overrides,
});

const submitAs = (authorization, body = validBody()) => {
  const req = request(app).post('/api/hazard-reports').send(body);
  return authorization ? req.set('Authorization', authorization) : req;
};

let areas;

beforeAll(async () => {
  await HazardReport.init();
});

beforeEach(async () => {
  areas = await seedAreas();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/hazard-reports', () => {
  it('Main 5-8 (TC-01): a citizen submits a valid report - 201, PENDING, GR reference, GPS', async () => {
    const citizen = await createUser({ role: Role.CITIZEN });

    const res = await submitAs(bearerFor(citizen));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.report).toMatchObject({
      referenceNo: expect.stringMatching(/^GR-\d{4,}$/),
      status: 'PENDING',
      locationSource: 'GPS',
      hazardType: 'RISING_RIVER_FLOOD',
      location: { latitude: 6.9382, longitude: 79.9012 },
      reporter: { id: citizen.id, role: Role.CITIZEN },
      isEscalatable: false,
      reviewedBy: null,
      reviewedAt: null,
      dismissalReason: null,
      dismissalNote: null,
      clientReportId: null,
    });
    expect(await HazardReport.countDocuments()).toBe(1);
  });

  it('Main 5 (TC-02): a community volunteer submits too (role inheritance) - 201', async () => {
    const volunteer = await createUser({ role: Role.COMMUNITY_VOLUNTEER });

    const res = await submitAs(bearerFor(volunteer));

    expect(res.status).toBe(201);
    expect(res.body.data.report.reporter.role).toBe(Role.COMMUNITY_VOLUNTEER);
  });

  it.each([Role.DUTY_OFFICER, Role.DMC_OFFICER, Role.DISTRICT_OFFICER, Role.RESCUE_TEAM_LEAD])(
    'Main 5 (TC-03): a %s cannot submit - 403 FORBIDDEN',
    async (role) => {
      const res = await submitAs(bearerFor(await createUser({ role })));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(await HazardReport.countDocuments()).toBe(0);
    },
  );

  it('Main 5 (TC-04): no token - 401', async () => {
    const res = await submitAs(null);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_HEADER_MISSING');
  });

  it('Main 5: an expired token - 401 TOKEN_EXPIRED', async () => {
    const res = await submitAs(expiredBearerFor(await createUser()));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('Main 8 (TC-05): derives the district from the coordinates', async () => {
    const res = await submitAs(bearerFor(await createUser()));

    expect(res.body.data.report.district).toEqual({ id: areas.colombo.id, name: 'Colombo' });
  });

  it('Main 8 (TC-06): concurrent submits get unique sequential references', async () => {
    const authorization = bearerFor(await createUser());

    const responses = await Promise.all(Array.from({ length: 6 }, () => submitAs(authorization)));

    expect(responses.every((res) => res.status === 201)).toBe(true);
    const refs = responses.map((res) => res.body.data.report.referenceNo).sort();
    expect(new Set(refs).size).toBe(6);
    expect(refs).toEqual(Array.from({ length: 6 }, (_, i) => `GR-000${i + 1}`));
  });

  it('Main 9 (TC-07): one inbox item per duty officer on shift in that district, none elsewhere', async () => {
    const onShift = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
    const gampahaShift = await createUser({
      role: Role.DUTY_OFFICER,
      shiftDistrict: areas.gampaha,
    });

    const res = await submitAs(bearerFor(await createUser()));

    const { id, referenceNo } = res.body.data.report;
    const inbox = await UserNotification.find({ user: onShift._id }).lean();
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      type: NotificationType.REPORT_SUBMITTED,
      body: `New ground report ${referenceNo} – Rising river / Flood – Colombo`,
      link: `/ground-reports/${id}`,
    });
    expect(await UserNotification.countDocuments({ user: gampahaShift._id })).toBe(0);
  });

  it('Main 9 (TC-08): the report is still 201 and stored when notifying fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(notificationService, 'notifyRole').mockRejectedValue(new Error('inbox down'));

    const res = await submitAs(bearerFor(await createUser()));

    expect(res.status).toBe(201);
    expect(await HazardReport.countDocuments()).toBe(1);
  });

  it('E1: an invalid body is 400 VALIDATION_ERROR with one entry per field, nothing stored', async () => {
    const res = await submitAs(
      bearerFor(await createUser()),
      validBody({ photoUrl: undefined, location: { latitude: -6.2088, longitude: 106.8456 } }),
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([
      { field: 'location', message: 'must be inside Sri Lanka' },
      { field: 'photoUrl', message: 'is required' },
    ]);
    expect(await HazardReport.countDocuments()).toBe(0);
  });

  it('A4: a second report of the same hazard nearby joins the first one’s cluster', async () => {
    const authorization = bearerFor(await createUser());
    const first = await submitAs(authorization);

    const second = await submitAs(
      authorization,
      validBody({ location: { latitude: 6.9385, longitude: 79.9015 } }),
    );

    expect(second.body.data.report.clusterId).toBe(first.body.data.report.id);
  });
});
