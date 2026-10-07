import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { LocationSource } from '../../src/enums/LocationSource.js';
import { ReportStatus } from '../../src/enums/ReportStatus.js';
import { Role } from '../../src/enums/Role.js';
import { HazardAlert } from '../../src/models/HazardAlert.js';
import { HazardReport } from '../../src/models/HazardReport.js';
import { bearerFor } from '../helpers/authHelper.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { createUser } from '../helpers/userFactory.js';

// UC01 A1 through the HTTP API (contract §12.10): a duty officer confirms a
// report (UC02, §9.6), then an officer escalates it to a warning.
let areas;
let duty;
let dmc;
let reporter;

beforeEach(async () => {
  areas = await seedAreas();
  duty = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
  dmc = await createUser({ role: Role.DMC_OFFICER });
  reporter = await createUser({ homeDistrict: areas.colombo });
});

const as = (user) => ({ Authorization: bearerFor(user) });

const createPendingReport = (fields = {}) => {
  const id = new mongoose.Types.ObjectId();
  return HazardReport.create({
    _id: id,
    referenceNo: 'GR-2481',
    reporter: reporter._id,
    description: 'Water level rising near the bridge',
    photoUrl: 'https://example.supabase.co/storage/v1/object/public/b/hazard-reports/a.jpg',
    hazardType: 'RISING_RIVER_FLOOD',
    location: { type: 'Point', coordinates: [79.9012, 6.9382] },
    locationSource: LocationSource.GPS,
    district: areas.colombo._id,
    submittedAt: new Date('2026-10-02T04:54:00.000Z'),
    clusterId: id,
    ...fields,
  });
};

const confirm = (report) =>
  request(app).post(`/api/hazard-reports/${report.id}/confirm`).set(as(duty)).send();

const escalate = (sourceReportId, user = duty) =>
  request(app).post('/api/hazard-alerts').set(as(user)).send({ sourceReportId });

describe('POST /api/hazard-alerts with sourceReportId', () => {
  it('A1: TC-16 a confirmed report escalates to a linked DRAFT with the pre-fill', async () => {
    const report = await createPendingReport();
    expect((await confirm(report)).status).toBe(200);
    expect(await HazardAlert.countDocuments()).toBe(0);

    const res = await escalate(report.id);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.prefill).toEqual({
      hazardType: 'FLOOD',
      districtId: areas.colombo.id,
      reportRef: { id: report.id, referenceNo: 'GR-2481' },
    });
    expect(res.body.data.alert).toMatchObject({
      status: 'DRAFT',
      hazardType: null,
      targets: [],
      sourceReport: { id: report.id, referenceNo: 'GR-2481' },
    });

    const reread = await request(app)
      .get(`/api/hazard-alerts/${res.body.data.alert.id}`)
      .set(as(duty));
    expect(reread.body.data.alert.sourceReport).toEqual({ id: report.id, referenceNo: 'GR-2481' });
  });

  it('A1: TC-16 a DMC officer outside the report district can escalate it too', async () => {
    const report = await createPendingReport({ hazardType: 'LANDSLIDE' });
    await confirm(report);

    const res = await escalate(report.id, dmc);

    expect(res.status).toBe(201);
    expect(res.body.data.prefill.hazardType).toBe('LANDSLIDE');
  });

  it('A1: TC-17 a confirmed BLOCKED_ROAD report leaves the hazard type empty', async () => {
    const report = await createPendingReport({ hazardType: 'BLOCKED_ROAD' });
    await confirm(report);

    const res = await escalate(report.id);

    expect(res.status).toBe(201);
    expect(res.body.data.prefill).toMatchObject({ hazardType: null, districtId: areas.colombo.id });
  });

  it('A1: TC-18 a PENDING report is 409 REPORT_NOT_ESCALATABLE and no draft is created', async () => {
    const report = await createPendingReport();

    const res = await escalate(report.id);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'REPORT_NOT_ESCALATABLE',
        message: 'Only a confirmed report can be escalated – current status: PENDING',
      },
    });
    expect(await HazardAlert.countDocuments()).toBe(0);
  });

  it('A1: TC-18 a DISMISSED report is 409 REPORT_NOT_ESCALATABLE', async () => {
    const report = await createPendingReport();
    await request(app)
      .post(`/api/hazard-reports/${report.id}/dismiss`)
      .set(as(duty))
      .send({ reason: 'NOT_A_HAZARD' });
    expect((await HazardReport.findById(report.id)).status).toBe(ReportStatus.DISMISSED);

    const res = await escalate(report.id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REPORT_NOT_ESCALATABLE');
  });

  it.each([
    ['an unknown id', new mongoose.Types.ObjectId().toString()],
    ['a malformed id', 'not-an-id'],
  ])('A1: TC-19 %s is 404 NOT_FOUND', async (_label, id) => {
    const res = await escalate(id);

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Hazard report not found.' });
    expect(await HazardAlert.countDocuments()).toBe(0);
  });

  it.each([
    ['a number', 42],
    ['an empty string', ''],
  ])('A1: sourceReportId as %s is 400 VALIDATION_ERROR', async (_label, value) => {
    const res = await escalate(value);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([
      { field: 'sourceReportId', message: 'must be a report id' },
    ]);
  });

  it('A1: a plain start has no prefill', async () => {
    const res = await request(app).post('/api/hazard-alerts').set(as(duty)).send({});

    expect(res.status).toBe(201);
    expect(res.body.data).not.toHaveProperty('prefill');
    expect(res.body.data.alert.sourceReport).toBeNull();
  });

  it.each([Role.DISTRICT_OFFICER, Role.CITIZEN])('A1: a %s cannot escalate (403)', async (role) => {
    const report = await createPendingReport();
    await confirm(report);
    const user = await createUser({ role, homeDistrict: areas.colombo });

    const res = await escalate(report.id, user);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
