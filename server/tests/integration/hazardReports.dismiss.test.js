import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Coordinates } from '../../src/domain/reports/Coordinates.js';
import { NotificationType } from '../../src/enums/NotificationType.js';
import { ReportStatus } from '../../src/enums/ReportStatus.js';
import { Role } from '../../src/enums/Role.js';
import { HazardReport } from '../../src/models/HazardReport.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { notificationService } from '../../src/services/NotificationService.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// POST /api/hazard-reports/:id/dismiss - UC02 A1 (contract §9.7), catalogue
// TC-16…TC-19, through the real app.
let areas;
let officer;
let citizen;

beforeAll(async () => {
  await HazardReport.init();
});

beforeEach(async () => {
  areas = await seedAreas();
  citizen = await createUser();
  officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const storeReport = ({ status = ReportStatus.PENDING, district = areas.colombo } = {}) => {
  const id = new mongoose.Types.ObjectId();
  return HazardReport.create({
    _id: id,
    referenceNo: 'GR-2476',
    reporter: citizen._id,
    description: 'Road blocked',
    photoUrl: 'https://example.test/hazard-reports/a.jpg',
    hazardType: 'BLOCKED_ROAD',
    location: new Coordinates({ latitude: 6.9022, longitude: 79.8771 }).toGeoJSON(),
    locationSource: 'GPS',
    district: district._id,
    status,
    submittedAt: new Date(),
    clusterId: id,
  });
};

const dismissAs = (user, id, body) =>
  request(app)
    .post(`/api/hazard-reports/${id}/dismiss`)
    .set('Authorization', bearerFor(user))
    .send(body);

describe('POST /api/hazard-reports/:id/dismiss', () => {
  it.each([
    ['INACCURATE', 'Inaccurate'],
    ['DUPLICATE', 'Duplicate'],
    ['NOT_A_HAZARD', 'Not a hazard'],
    ['INSUFFICIENT_EVIDENCE', 'Insufficient evidence'],
  ])('A1.2 (TC-16): dismisses with reason %s', async (reason) => {
    const report = await storeReport();

    const res = await dismissAs(officer, report.id, { reason, note: 'Same flooding as GR-2474' });

    expect(res.status).toBe(200);
    expect(res.body.data.report).toMatchObject({
      status: 'DISMISSED',
      dismissalReason: reason,
      dismissalNote: 'Same flooding as GR-2474',
      reviewedBy: { id: officer.id, name: officer.name },
      reviewedAt: expect.any(String),
      isEscalatable: false,
    });
    expect((await HazardReport.findById(report.id)).dismissalReason).toBe(reason);
  });

  it('A1.1: the note is optional, and a blank note is stored as none', async () => {
    const first = await storeReport();

    const res = await dismissAs(officer, first.id, { reason: 'INACCURATE', note: '   ' });

    expect(res.status).toBe(200);
    expect(res.body.data.report.dismissalNote).toBeNull();
  });

  it.each([
    ['missing', {}, 'is required'],
    [
      'unknown',
      { reason: 'SPAM' },
      'must be one of [INACCURATE, DUPLICATE, NOT_A_HAZARD, INSUFFICIENT_EVIDENCE]',
    ],
  ])('A1.1 (TC-17): a %s reason is 400 on field reason', async (_label, body, message) => {
    const report = await storeReport();

    const res = await dismissAs(officer, report.id, body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([{ field: 'reason', message }]);
    expect((await HazardReport.findById(report.id)).status).toBe('PENDING');
  });

  it('A1.1 (TC-18): accepts a 200-character note', async () => {
    const report = await storeReport();

    const res = await dismissAs(officer, report.id, { reason: 'DUPLICATE', note: 'x'.repeat(200) });

    expect(res.status).toBe(200);
  });

  it('A1.1 (TC-18): refuses a 201-character note on field note', async () => {
    const report = await storeReport();

    const res = await dismissAs(officer, report.id, { reason: 'DUPLICATE', note: 'x'.repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'note', message: 'must be at most 200 characters' },
    ]);
  });

  it('A1.3 (TC-19): the reporter is thanked politely, with the reason’s label', async () => {
    const report = await storeReport();

    await dismissAs(officer, report.id, { reason: 'DUPLICATE' });

    const inbox = await UserNotification.find({ user: citizen._id }).lean();
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      type: NotificationType.REPORT_DISMISSED,
      title: 'Report GR-2476 reviewed',
      body:
        'Thank you for report GR-2476. After review it was not used for a warning ' +
        '(reason: Duplicate). Please keep reporting what you see.',
      link: `/my-reports/${report.id}`,
    });
  });

  it('A1.3: the dismissal stands when telling the reporter fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(notificationService, 'notifyUser').mockRejectedValue(new Error('inbox down'));
    const report = await storeReport();

    const res = await dismissAs(officer, report.id, { reason: 'INACCURATE' });

    expect(res.status).toBe(200);
    expect((await HazardReport.findById(report.id)).status).toBe('DISMISSED');
  });

  it('A1.2: a dismissed report leaves the pending queue', async () => {
    const report = await storeReport();

    await dismissAs(officer, report.id, { reason: 'NOT_A_HAZARD' });
    const queue = await request(app)
      .get('/api/hazard-reports?status=PENDING')
      .set('Authorization', bearerFor(officer));

    expect(queue.body.data.clusters).toEqual([]);
  });

  it('E3 (TC-39): dismissing a CONFIRMED report is 409', async () => {
    const report = await storeReport({ status: ReportStatus.CONFIRMED });

    const res = await dismissAs(officer, report.id, { reason: 'DUPLICATE' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REPORT_ALREADY_REVIEWED');
    expect((await HazardReport.findById(report.id)).status).toBe('CONFIRMED');
  });

  it('A1: a report in another district is 404', async () => {
    const report = await storeReport({ district: areas.gampaha });

    const res = await dismissAs(officer, report.id, { reason: 'DUPLICATE' });

    expect(res.status).toBe(404);
  });

  it.each([Role.DMC_OFFICER, Role.DISTRICT_OFFICER, Role.CITIZEN])(
    'A1: a %s cannot dismiss - 403',
    async (role) => {
      const report = await storeReport();

      const res = await dismissAs(await createUser({ role }), report.id, { reason: 'DUPLICATE' });

      expect(res.status).toBe(403);
    },
  );
});
