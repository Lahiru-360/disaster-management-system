import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { Organisation } from '../../src/models/Organisation.js';
import { PostEventReport } from '../../src/models/PostEventReport.js';
import { ReportExport } from '../../src/models/ReportExport.js';
import { ReportShare } from '../../src/models/ReportShare.js';
import { emailService } from '../../src/services/EmailService.js';
import { storageService } from '../../src/services/StorageService.js';
import { ApiError } from '../../src/utils/ApiError.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC04 main flow steps 14-15 (DMS-155, contract §14.9-14.10): sharing a stored
// Kelani report with an organisation by email. The email goes through the
// no-op transport, which records it, and storage is faked, so each upload is
// recorded here instead of reaching Supabase.
let officer;
let report;
let unicef;
let uploads;

const reportFields = (fields = {}) => ({
  event: report?.event,
  generatedBy: officer._id,
  generatedAt: new Date('2026-10-06T09:00:00.000Z'),
  dateFrom: '2026-06-13',
  dateTo: '2026-06-15',
  districts: report?.districts,
  summary: { peakOccupancy: 450, peakOccupancyDate: '2026-06-13' },
  sections: [
    {
      key: 'occupancyOverTime',
      result: {
        districts: [
          {
            district: { id: String(report?.districts?.[0]), name: 'Colombo' },
            days: [
              { date: '2026-06-13', peak: 450 },
              { date: '2026-06-14', peak: null },
              { date: '2026-06-15', peak: null },
            ],
            peak: { value: 450, date: '2026-06-13' },
          },
        ],
      },
    },
  ],
  gaps: [
    {
      section: 'occupancyOverTime',
      from: '2026-06-14',
      to: '2026-06-15',
      reason: 'No occupancy records',
    },
  ],
  ...fields,
});

const seedReport = async () => {
  const areas = await seedAreas();
  officer = await createUser({ role: Role.DMC_OFFICER, name: 'Ruwan Jayasinghe' });
  const event = await HazardEvent.create({
    name: 'Kelani basin floods',
    hazardType: 'FLOOD',
    status: 'CLOSED',
    startDate: new Date('2026-06-08'),
    endDate: new Date('2026-06-20'),
    districts: [areas.colombo._id],
  });
  report = await PostEventReport.create(
    reportFields({ event: event._id, districts: [areas.colombo._id] }),
  );
  unicef = await Organisation.create({
    name: 'UNICEF Sri Lanka',
    type: 'DONOR',
    contactEmail: 'liaison@example.org',
  });
};

const shareReport = (id, body, user = officer) =>
  request(app)
    .post(`/api/post-event-reports/${id}/shares`)
    .set('Authorization', bearerFor(user))
    .send(body);

const validBody = (fields = {}) => ({
  organisationId: String(unicef._id),
  recipientEmail: 'liaison@example.org',
  ...fields,
});

const exportFields = (fields = {}) => ({
  report: report._id,
  format: 'PDF',
  fileUrl: 'https://storage.example/reports/old',
  createdBy: officer._id,
  ...fields,
});

const sentEmails = () => emailService.transport.getSentEmails();

beforeEach(async () => {
  await seedReport();
  uploads = [];
  emailService.transport.clearSentEmails();
  jest.spyOn(storageService, 'storeFile').mockImplementation(async (file, mimeType, folder) => {
    uploads.push({ file, mimeType, folder });
    return `https://storage.example/${folder}/${uploads.length}`;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/post-event-reports/:id/shares — access', () => {
  it.each([Role.DISTRICT_OFFICER, Role.CITIZEN])(
    'TC-24 Main 14: a %s cannot share a report (403)',
    async (role) => {
      const res = await shareReport(report._id, validBody(), await createUser({ role }));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(sentEmails()).toHaveLength(0);
    },
  );

  it('TC-24 Main 14: without a token the request is refused (401)', async () => {
    const res = await request(app)
      .post(`/api/post-event-reports/${report._id}/shares`)
      .send(validBody());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_HEADER_MISSING');
  });

  it('DMS-155.6: a duty officer can share a report another officer generated', async () => {
    const dutyOfficer = await createUser({ role: Role.DUTY_OFFICER });

    const res = await shareReport(report._id, validBody(), dutyOfficer);

    expect(res.status).toBe(201);
    expect((await ReportShare.findOne()).sharedBy).toEqual(dutyOfficer._id);
  });
});

describe('POST /api/post-event-reports/:id/shares — sharing', () => {
  it('TC-24 Main 14-15: emails the contact and stores a SENT ReportShare', async () => {
    await ReportExport.create(exportFields());

    const res = await shareReport(report._id, validBody());

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      shareId: expect.any(String),
      exportId: expect.any(String),
      format: 'PDF',
      fileUrl: 'https://storage.example/reports/old',
      organisation: { id: String(unicef._id), name: 'UNICEF Sri Lanka' },
      recipientEmail: 'liaison@example.org',
      message: 'Post-event summary',
      sharedBy: { id: String(officer._id), name: 'Ruwan Jayasinghe' },
      sharedAt: expect.any(String),
      status: 'SENT',
      attempts: 1,
      failureReason: null,
    });
    expect(sentEmails()).toHaveLength(1);
    expect(sentEmails()[0].to).toBe('liaison@example.org');
    const saved = await ReportShare.findById(res.body.data.shareId).lean();
    expect(saved).toEqual(
      expect.objectContaining({
        report: report._id,
        organisation: unicef._id,
        recipientEmail: 'liaison@example.org',
        sharedBy: officer._id,
        status: 'SENT',
      }),
    );
  });

  it('TC-25 Main 14: with no export in the format, one is created first and shared', async () => {
    await ReportExport.create(exportFields({ fileUrl: 'https://storage.example/reports/pdf' }));

    const res = await shareReport(report._id, validBody({ format: 'CSV' }));

    expect(res.status).toBe(201);
    expect(res.body.data.format).toBe('CSV');
    expect(uploads).toHaveLength(1);
    expect(uploads[0].mimeType).toBe('text/csv');
    expect(res.body.data.fileUrl).toBe('https://storage.example/reports/1');
    const exports = await ReportExport.find({ report: report._id }).lean();
    expect(exports.map((e) => e.format).sort()).toEqual(['CSV', 'PDF']);
    expect(String(exports.find((e) => e.format === 'CSV')._id)).toBe(res.body.data.exportId);
  });

  it('TC-25 Main 14: defaults to PDF and creates it when the report was never exported', async () => {
    const res = await shareReport(report._id, validBody());

    expect(res.status).toBe(201);
    expect(res.body.data.format).toBe('PDF');
    expect(uploads).toHaveLength(1);
    expect(await ReportExport.countDocuments()).toBe(1);
  });

  it('TC-25 Main 14: reuses the newest export in the format instead of making another', async () => {
    await ReportExport.create(
      exportFields({
        fileUrl: 'https://storage.example/reports/older',
        createdAt: new Date('2026-10-06T10:00:00.000Z'),
      }),
    );
    await ReportExport.create(
      exportFields({
        fileUrl: 'https://storage.example/reports/newer',
        createdAt: new Date('2026-10-06T11:00:00.000Z'),
      }),
    );

    const res = await shareReport(report._id, validBody());

    expect(res.body.data.fileUrl).toBe('https://storage.example/reports/newer');
    expect(uploads).toHaveLength(0);
    expect(await ReportExport.countDocuments()).toBe(2);
  });

  it('TC-28 Main 15: the email carries the subject, the message and the link to the file', async () => {
    const res = await shareReport(report._id, validBody({ message: 'Figures for your review' }));

    const [email] = sentEmails();
    expect(email.subject).toBe('Post-event report – Kelani basin floods');
    for (const body of [email.html, email.text]) {
      expect(body).toContain(res.body.data.fileUrl);
      expect(body).toContain('Figures for your review');
      expect(body).toContain('Ruwan Jayasinghe');
    }
  });

  it('DMS-155.6: sharing twice creates two shares on the one export', async () => {
    await shareReport(report._id, validBody());
    await shareReport(report._id, validBody());

    expect(await ReportShare.countDocuments()).toBe(2);
    expect(await ReportExport.countDocuments()).toBe(1);
    expect(sentEmails()).toHaveLength(2);
  });

  it('DMS-155.6: trims the email and the message', async () => {
    const res = await shareReport(
      report._id,
      validBody({ recipientEmail: '  liaison@example.org ', message: '  Hello  ' }),
    );

    expect(res.status).toBe(201);
    expect(res.body.data.recipientEmail).toBe('liaison@example.org');
    expect(res.body.data.message).toBe('Hello');
  });
});

describe('POST /api/post-event-reports/:id/shares — rejected requests', () => {
  it.each([
    ['missing', undefined],
    ['not an address', 'liaison.example.org'],
    ['blank', '   '],
    ['too long', `${'a'.repeat(250)}@example.org`],
  ])('TC-26 Main 14: a recipient email that is %s is 400 on recipientEmail', async (_, value) => {
    const res = await shareReport(report._id, validBody({ recipientEmail: value }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect([...new Set(res.body.error.errors.map((e) => e.field))]).toEqual(['recipientEmail']);
    expect(sentEmails()).toHaveLength(0);
    expect(await ReportShare.countDocuments()).toBe(0);
  });

  it('TC-27 Main 14: an organisation no one has is 404, and nothing is exported or sent', async () => {
    const res = await shareReport(
      report._id,
      validBody({ organisationId: String(new mongoose.Types.ObjectId()) }),
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(uploads).toHaveLength(0);
    expect(await ReportExport.countDocuments()).toBe(0);
    expect(sentEmails()).toHaveLength(0);
  });

  it('DMS-155.6: an organisation id that is not an id is 400 on organisationId', async () => {
    const res = await shareReport(report._id, validBody({ organisationId: 'not-an-id' }));

    expect(res.status).toBe(400);
    expect(res.body.error.errors.map((e) => e.field)).toEqual(['organisationId']);
  });

  it('DMS-155.6: a format other than PDF or CSV is 400 on format', async () => {
    const res = await shareReport(report._id, validBody({ format: 'XLSX' }));

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'format', message: 'must be one of [PDF, CSV]' },
    ]);
  });

  it.each([
    ['blank', '   '],
    ['over 500 characters', 'x'.repeat(501)],
  ])('DMS-155.6: a message that is %s is 400 on message', async (_, message) => {
    const res = await shareReport(report._id, validBody({ message }));

    expect(res.status).toBe(400);
    expect(res.body.error.errors.map((e) => e.field)).toEqual(['message']);
  });

  it('DMS-155.6: a report no one has, or an id that is not an id, is 404', async () => {
    const unknown = await shareReport(new mongoose.Types.ObjectId(), validBody());
    const invalid = await shareReport('not-an-id', validBody());

    expect(unknown.status).toBe(404);
    expect(invalid.status).toBe(404);
    expect(invalid.body.error.code).toBe('NOT_FOUND');
    expect(sentEmails()).toHaveLength(0);
  });

  it('DMS-155.6: when the missing export cannot be stored, nothing is emailed or recorded', async () => {
    storageService.storeFile.mockRejectedValue(
      new ApiError(502, 'STORAGE_UNAVAILABLE', 'Could not upload the file. Please try again.'),
    );

    const res = await shareReport(report._id, validBody());

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('STORAGE_UNAVAILABLE');
    expect(sentEmails()).toHaveLength(0);
    expect(await ReportShare.countDocuments()).toBe(0);
    expect(await ReportExport.countDocuments()).toBe(0);
  });

  it('TC-47 E4: when the email cannot be sent, the answer is 502 EMAIL_UNAVAILABLE, the share is FAILED and the export is kept', async () => {
    jest
      .spyOn(emailService, 'send')
      .mockRejectedValue(
        new ApiError(502, 'EMAIL_UNAVAILABLE', 'Could not send the email. Please try again.'),
      );

    const res = await shareReport(report._id, validBody());

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('EMAIL_UNAVAILABLE');
    expect(await ReportExport.countDocuments()).toBe(1);
    const [failed] = await ReportShare.find().lean();
    expect(failed).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        attempts: 1,
        failureReason: 'Could not send the email. Please try again.',
        recipientEmail: 'liaison@example.org',
      }),
    );
  });
});

describe('GET /api/post-event-reports/:id/shares', () => {
  const listShares = (id, user = officer) =>
    request(app).get(`/api/post-event-reports/${id}/shares`).set('Authorization', bearerFor(user));

  it('DMS-155.6: a report nobody has shared lists no shares', async () => {
    const res = await listShares(report._id);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ shares: [] });
  });

  it('DMS-155.6: lists the report shares newest first, each with its status', async () => {
    const redCross = await Organisation.create({
      name: 'Red Cross Sri Lanka',
      type: 'NGO',
      contactEmail: 'contact@redcross.example.test',
    });
    await shareReport(report._id, validBody());
    await shareReport(
      report._id,
      validBody({
        organisationId: String(redCross._id),
        recipientEmail: 'contact@redcross.example.test',
      }),
    );

    const res = await listShares(report._id);

    expect(res.status).toBe(200);
    expect(res.body.data.shares.map((s) => s.organisation.name)).toEqual([
      'Red Cross Sri Lanka',
      'UNICEF Sri Lanka',
    ]);
    expect(res.body.data.shares.map((s) => s.status)).toEqual(['SENT', 'SENT']);
  });

  it('DMS-155.6: does not list another report shares', async () => {
    const other = await PostEventReport.create(reportFields());
    await shareReport(other._id, validBody());

    const res = await listShares(report._id);

    expect(res.body.data.shares).toEqual([]);
  });

  it('DMS-155.6: an unknown report is 404, and a citizen is 403', async () => {
    const unknown = await listShares(new mongoose.Types.ObjectId());
    const citizen = await listShares(report._id, await createUser({ role: Role.CITIZEN }));

    expect(unknown.status).toBe(404);
    expect(citizen.status).toBe(403);
  });
});
