import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { OccupancyRecord } from '../../src/models/OccupancyRecord.js';
import { PostEventReport } from '../../src/models/PostEventReport.js';
import { ReportExport } from '../../src/models/ReportExport.js';
import { ReportShare } from '../../src/models/ReportShare.js';
import { emailService } from '../../src/services/EmailService.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC04 A3 (DMS-158, step 12): the officer looks at the report on screen and
// closes it without exporting. Closing is only the web leaving the report
// view, so on the server a generated report must be the one thing stored: one
// PostEventReport, no ReportExport, no ReportShare and no email. It can then be
// reopened from Recent reports (§14.5, §14.4).
const { ObjectId } = mongoose.Types;

let areas;
let event;
let officer;

beforeEach(async () => {
  areas = await seedAreas();
  officer = await createUser({ role: Role.DMC_OFFICER, name: 'Ruwan Jayasinghe' });
  event = await HazardEvent.create({
    name: 'Kelani basin floods',
    hazardType: 'FLOOD',
    status: 'CLOSED',
    startDate: new Date('2026-06-08'),
    endDate: new Date('2026-06-20'),
    districts: [areas.colombo._id],
  });
  await OccupancyRecord.create({
    shelter: new ObjectId(),
    district: areas.colombo._id,
    occupants: 120,
    capacity: 500,
    recordedAt: new Date('2026-06-12T12:00:00.000+05:30'),
    recordedBy: officer._id,
  });
  emailService.transport.clearSentEmails();
});

const generate = () =>
  request(app)
    .post('/api/post-event-reports')
    .set('Authorization', bearerFor(officer))
    .send({
      eventId: String(event._id),
      from: '2026-06-08',
      to: '2026-06-20',
      districtIds: [String(areas.colombo._id)],
      sections: ['occupancyOverTime'],
    });

const get = (path) => request(app).get(path).set('Authorization', bearerFor(officer));

const counts = async () => ({
  reports: await PostEventReport.countDocuments(),
  exports: await ReportExport.countDocuments(),
  shares: await ReportShare.countDocuments(),
  emails: emailService.transport.getSentEmails().length,
});

describe('UC04 A3: view only', () => {
  it('TC-34 A3: generating and then closing stores one report, no export and no share', async () => {
    const res = await generate();

    expect(res.status).toBe(201);
    expect(await counts()).toEqual({ reports: 1, exports: 0, shares: 0, emails: 0 });
  });

  it('TC-34 A3: reading the report and the recent list changes nothing', async () => {
    const created = (await generate()).body.data.report;

    await get(`/api/post-event-reports/${created.id}`);
    await get(`/api/post-event-reports?eventId=${event._id}`);

    expect(await counts()).toEqual({ reports: 1, exports: 0, shares: 0, emails: 0 });
  });

  it('TC-34 A3: the closed report is listed under Recent reports for its event', async () => {
    const created = (await generate()).body.data.report;

    const res = await get(`/api/post-event-reports?eventId=${event._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reports.map((report) => report.id)).toEqual([created.id]);
  });

  it('TC-34 A3: reopening it from the list shows the report exactly as generated', async () => {
    const created = (await generate()).body.data.report;
    const [listed] = (await get(`/api/post-event-reports?eventId=${event._id}`)).body.data.reports;

    const reopened = await get(`/api/post-event-reports/${listed.id}`);

    expect(reopened.status).toBe(200);
    expect(reopened.body.data.report).toEqual(created);
  });

  it('TC-34 A3: another event has no recent reports', async () => {
    await generate();

    const res = await get(`/api/post-event-reports?eventId=${new ObjectId()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ reports: [] });
  });
});
