import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Coordinates } from '../../src/domain/reports/Coordinates.js';
import { ReportStatus } from '../../src/enums/ReportStatus.js';
import { Role } from '../../src/enums/Role.js';
import { HazardReport } from '../../src/models/HazardReport.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC02 E3 - report already reviewed by another officer (contract §9.6),
// catalogue TC-38…TC-40, through the real app.
let areas;
let officer;
let colleague;
let citizen;

beforeAll(async () => {
  await HazardReport.init();
});

beforeEach(async () => {
  areas = await seedAreas();
  citizen = await createUser();
  officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
  colleague = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
});

const storeReport = (status = ReportStatus.PENDING) => {
  const id = new mongoose.Types.ObjectId();
  return HazardReport.create({
    _id: id,
    referenceNo: 'GR-2481',
    reporter: citizen._id,
    description: 'Water rising',
    photoUrl: 'https://example.test/hazard-reports/a.jpg',
    hazardType: 'RISING_RIVER_FLOOD',
    location: new Coordinates({ latitude: 6.9382, longitude: 79.9012 }).toGeoJSON(),
    locationSource: 'GPS',
    district: areas.colombo._id,
    status,
    submittedAt: new Date(),
    clusterId: id,
  });
};

const confirmAs = (user, id) =>
  request(app).post(`/api/hazard-reports/${id}/confirm`).set('Authorization', bearerFor(user));

const expectAlreadyReviewed = (res, status) => {
  expect(res.status).toBe(409);
  expect(res.body).toEqual({
    success: false,
    error: {
      code: 'REPORT_ALREADY_REVIEWED',
      message: `Already reviewed – current status: ${status}`,
    },
  });
};

describe('E3: report already reviewed', () => {
  it('E3 (TC-38): a second confirm is 409 and keeps the first reviewer', async () => {
    const report = await storeReport();
    await confirmAs(officer, report.id);

    const res = await confirmAs(colleague, report.id);

    expectAlreadyReviewed(res, 'CONFIRMED');
    const stored = await HazardReport.findById(report.id);
    expect(stored.reviewedBy).toEqual(officer._id);
    expect(await UserNotification.countDocuments({ user: citizen._id })).toBe(1);
  });

  it('E3 (TC-39): confirming a DISMISSED report is 409 and it stays DISMISSED', async () => {
    const report = await storeReport(ReportStatus.DISMISSED);

    const res = await confirmAs(officer, report.id);

    expectAlreadyReviewed(res, 'DISMISSED');
    expect((await HazardReport.findById(report.id)).status).toBe('DISMISSED');
    expect(await UserNotification.countDocuments()).toBe(0);
  });

  it('E3 (TC-40): two officers confirming at the same moment - exactly one 200, one 409', async () => {
    const report = await storeReport();

    const responses = await Promise.all([
      confirmAs(officer, report.id),
      confirmAs(colleague, report.id),
    ]);

    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    const winner = responses.find((res) => res.status === 200).body.data.report.reviewedBy.id;
    expect(String((await HazardReport.findById(report.id)).reviewedBy)).toBe(winner);
    expect(await UserNotification.countDocuments({ user: citizen._id })).toBe(1);
  });
});
