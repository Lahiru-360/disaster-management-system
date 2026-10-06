import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Coordinates } from '../../src/domain/reports/Coordinates.js';
import { NotificationType } from '../../src/enums/NotificationType.js';
import { ReportStatus } from '../../src/enums/ReportStatus.js';
import { Role } from '../../src/enums/Role.js';
import { HazardReport } from '../../src/models/HazardReport.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC02 main flow steps 10-15 through the real app (contract §9.3-9.6),
// catalogue TC-09…TC-15.
let areas;
let citizen;
let officer;
let sequence;

beforeAll(async () => {
  await HazardReport.init();
});

beforeEach(async () => {
  areas = await seedAreas();
  citizen = await createUser();
  officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
  sequence = 0;
});

const storeReport = async ({
  district = areas.colombo,
  status = ReportStatus.PENDING,
  minutesAgo = 10,
  cluster,
  reporter = citizen,
  hazardType = 'RISING_RIVER_FLOOD',
} = {}) => {
  sequence += 1;
  const id = new mongoose.Types.ObjectId();
  return HazardReport.create({
    _id: id,
    referenceNo: `GR-${String(2470 + sequence)}`,
    reporter: reporter._id,
    description: 'Water rising',
    photoUrl: 'https://example.test/hazard-reports/a.jpg',
    hazardType,
    location: new Coordinates({ latitude: 6.9382, longitude: 79.9012 }).toGeoJSON(),
    locationSource: 'GPS',
    district: district._id,
    status,
    submittedAt: new Date(Date.now() - minutesAgo * 60 * 1000),
    clusterId: cluster ? cluster.clusterId : id,
  });
};

const getAs = (user, path) =>
  request(app).get(`/api/hazard-reports${path}`).set('Authorization', bearerFor(user));
const confirmAs = (user, id) =>
  request(app).post(`/api/hazard-reports/${id}/confirm`).set('Authorization', bearerFor(user));

describe('GET /api/hazard-reports?status=PENDING (step 10)', () => {
  it('Main 10 (TC-09): the officer’s district’s PENDING reports, grouped by cluster', async () => {
    const lead = await storeReport({ minutesAgo: 50 });
    const joined = await storeReport({ minutesAgo: 6, cluster: lead });
    const alone = await storeReport({ minutesAgo: 20, hazardType: 'LANDSLIDE' });
    await storeReport({ status: ReportStatus.CONFIRMED });
    await storeReport({ district: areas.gampaha });

    const res = await getAs(officer, '?status=PENDING');

    expect(res.status).toBe(200);
    const { clusters } = res.body.data;
    expect(clusters.map((c) => [c.clusterId, c.count])).toEqual([
      [lead.id, 2],
      [alone.id, 1],
    ]);
    expect(clusters[0].reports.map((r) => r.referenceNo)).toEqual([
      joined.referenceNo,
      lead.referenceNo,
    ]);
    expect(clusters[0].reports[0]).toMatchObject({
      district: { id: areas.colombo.id, name: 'Colombo' },
      reporter: { id: citizen.id, role: Role.CITIZEN },
      isEscalatable: false,
    });
  });

  it.each([Role.DMC_OFFICER, Role.DISTRICT_OFFICER, Role.CITIZEN, Role.RESCUE_TEAM_LEAD])(
    'Main 10 (TC-10): a %s cannot open the queue - 403',
    async (role) => {
      const res = await getAs(await createUser({ role }), '?status=PENDING');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    },
  );

  it.each([
    ['missing', '', 'is required'],
    ['not PENDING', '?status=CONFIRMED', 'must be one of [PENDING]'],
  ])('Main 10: status %s - 400 VALIDATION_ERROR', async (_label, query, message) => {
    const res = await getAs(officer, query);

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([{ field: 'status', message }]);
  });

  it('Main 10: an officer with no shiftDistrict gets an empty queue', async () => {
    await storeReport();

    const res = await getAs(await createUser({ role: Role.DUTY_OFFICER }), '?status=PENDING');

    expect(res.status).toBe(200);
    expect(res.body.data.clusters).toEqual([]);
  });
});

describe('GET /api/hazard-reports/:id (step 11)', () => {
  it('Main 11: the report and its cluster', async () => {
    const lead = await storeReport({ minutesAgo: 50 });
    const latest = await storeReport({ minutesAgo: 6, cluster: lead });

    const res = await getAs(officer, `/${latest.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.report.referenceNo).toBe(latest.referenceNo);
    expect(res.body.data.cluster).toMatchObject({
      clusterId: lead.id,
      count: 2,
      others: [{ id: lead.id, referenceNo: lead.referenceNo, status: 'PENDING' }],
    });
  });

  it.each([
    ['in another district', async () => (await storeReport({ district: areas.gampaha })).id],
    ['unknown', async () => new mongoose.Types.ObjectId().toString()],
    ['malformed', async () => 'not-an-id'],
  ])('Main 11 (TC-11): a report %s - 404 NOT_FOUND', async (_label, idOf) => {
    const res = await getAs(officer, `/${await idOf()}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Hazard report not found.' });
  });

  it('Main 11: a DMC officer cannot open a report - 403', async () => {
    const report = await storeReport();

    const res = await getAs(await createUser({ role: Role.DMC_OFFICER }), `/${report.id}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/hazard-reports/:id/confirm (steps 12-14)', () => {
  it('Main 12-13 (TC-12): CONFIRMED with reviewer and time, escalatable', async () => {
    const pending = await storeReport();

    const res = await confirmAs(officer, pending.id);

    expect(res.status).toBe(200);
    expect(res.body.data.report).toMatchObject({
      id: pending.id,
      status: 'CONFIRMED',
      reviewedBy: { id: officer.id, name: officer.name },
      reviewedAt: expect.any(String),
      isEscalatable: true,
    });
  });

  it('Main 13 (TC-13): confirming creates no hazard alert', async () => {
    const pending = await storeReport();

    await confirmAs(officer, pending.id);

    expect(await mongoose.connection.db.collection('hazardalerts').countDocuments()).toBe(0);
  });

  it('Main 14 (TC-14): the reporter is notified of the confirmation', async () => {
    const pending = await storeReport();

    await confirmAs(officer, pending.id);

    const inbox = await UserNotification.find({ user: citizen._id }).lean();
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      type: NotificationType.REPORT_CONFIRMED,
      body: `Your report ${pending.referenceNo} was confirmed by the duty officer. Thank you.`,
    });
  });

  it('Main 12: a report in another district - 404, still PENDING', async () => {
    const elsewhere = await storeReport({ district: areas.gampaha });

    const res = await confirmAs(officer, elsewhere.id);

    expect(res.status).toBe(404);
    expect((await HazardReport.findById(elsewhere.id)).status).toBe('PENDING');
  });

  it.each([Role.DMC_OFFICER, Role.DISTRICT_OFFICER, Role.CITIZEN])(
    'Main 12: a %s cannot confirm - 403',
    async (role) => {
      const pending = await storeReport();

      const res = await confirmAs(await createUser({ role }), pending.id);

      expect(res.status).toBe(403);
      expect((await HazardReport.findById(pending.id)).status).toBe('PENDING');
    },
  );
});

describe('GET /api/hazard-reports/mine', () => {
  it('Main (TC-15): only the caller’s own reports, newest first', async () => {
    const older = await storeReport({ minutesAgo: 90, status: ReportStatus.DISMISSED });
    const newer = await storeReport({ minutesAgo: 5 });
    await storeReport({ reporter: await createUser() });

    const res = await getAs(citizen, '/mine');

    expect(res.status).toBe(200);
    expect(res.body.data.reports.map((r) => r.referenceNo)).toEqual([
      newer.referenceNo,
      older.referenceNo,
    ]);
  });

  it('Main: a community volunteer sees their own reports too', async () => {
    const volunteer = await createUser({ role: Role.COMMUNITY_VOLUNTEER });
    await storeReport({ reporter: volunteer });

    const res = await getAs(volunteer, '/mine');

    expect(res.status).toBe(200);
    expect(res.body.data.reports).toHaveLength(1);
  });

  it('Main: a duty officer has no "mine" - 403', async () => {
    const res = await getAs(officer, '/mine');

    expect(res.status).toBe(403);
  });

  it('Main: no reports - 200 with an empty list', async () => {
    const res = await getAs(citizen, '/mine');

    expect(res.body.data.reports).toEqual([]);
  });
});
