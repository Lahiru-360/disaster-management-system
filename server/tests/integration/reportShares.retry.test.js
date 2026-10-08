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
import { ApiError } from '../../src/utils/ApiError.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC04 E4 (DMS-162, contract §14.11): a share whose email failed is recorded
// FAILED with its export kept, and retrying it updates that same share. The
// email transport is the no-op one, made to fail by spying on send().
let officer;
let report;
let exported;
let failedShare;

const emailDown = () =>
  new ApiError(502, 'EMAIL_UNAVAILABLE', 'Could not send the email. Please try again.');

const sentEmails = () => emailService.transport.getSentEmails();

const retryShare = (id, user = officer) =>
  request(app).post(`/api/report-shares/${id}/retry`).set('Authorization', bearerFor(user));

const shareFields = (fields = {}) => ({
  report: report._id,
  export: exported._id,
  organisation: undefined,
  recipientEmail: 'liaison@example.org',
  message: 'Figures for your review',
  sharedBy: officer._id,
  sharedAt: new Date('2026-10-07T09:45:00.000Z'),
  ...fields,
});

beforeEach(async () => {
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
  report = await PostEventReport.create({
    event: event._id,
    generatedBy: officer._id,
    generatedAt: new Date('2026-10-06T09:00:00.000Z'),
    dateFrom: '2026-06-13',
    dateTo: '2026-06-15',
    districts: [areas.colombo._id],
    summary: {},
    sections: [{ key: 'occupancyOverTime', result: { districts: [] } }],
    gaps: [],
  });
  const unicef = await Organisation.create({
    name: 'UNICEF Sri Lanka',
    type: 'DONOR',
    contactEmail: 'liaison@example.org',
  });
  exported = await ReportExport.create({
    report: report._id,
    format: 'PDF',
    fileUrl: 'https://storage.example/reports/a.pdf',
    createdBy: officer._id,
  });
  failedShare = await ReportShare.create(
    shareFields({
      organisation: unicef._id,
      status: 'FAILED',
      attempts: 1,
      failureReason: 'Could not send the email. Please try again.',
    }),
  );
  emailService.transport.clearSentEmails();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/report-shares/:id/retry', () => {
  it('TC-48 E4: a retry that works updates the same share to SENT with attempts 2 and a new sharedAt', async () => {
    const before = failedShare.sharedAt;

    const res = await retryShare(failedShare._id);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        shareId: String(failedShare._id),
        status: 'SENT',
        attempts: 2,
        failureReason: null,
        recipientEmail: 'liaison@example.org',
        message: 'Figures for your review',
        sharedBy: { id: String(officer._id), name: 'Ruwan Jayasinghe' },
      }),
    );
    expect(new Date(res.body.data.sharedAt).getTime()).toBeGreaterThan(before.getTime());
    expect(await ReportShare.countDocuments()).toBe(1);
    const saved = await ReportShare.findById(failedShare._id).lean();
    expect(saved).toEqual(
      expect.objectContaining({ status: 'SENT', attempts: 2, failureReason: null }),
    );
  });

  it('TC-48 E4: resends the same file to the same recipient without exporting again', async () => {
    await retryShare(failedShare._id);

    expect(sentEmails()).toHaveLength(1);
    expect(sentEmails()[0].to).toBe('liaison@example.org');
    expect(sentEmails()[0].html).toContain('https://storage.example/reports/a.pdf');
    expect(sentEmails()[0].text).toContain('Figures for your review');
    expect(sentEmails()[0].text).toContain('Ruwan Jayasinghe');
    expect(await ReportExport.countDocuments()).toBe(1);
  });

  it('TC-49 E4: a retry that fails again leaves the share FAILED and raises attempts to 3 on the next', async () => {
    jest.spyOn(emailService, 'send').mockRejectedValue(emailDown());

    const second = await retryShare(failedShare._id);
    const third = await retryShare(failedShare._id);

    expect(second.status).toBe(502);
    expect(second.body.error.code).toBe('EMAIL_UNAVAILABLE');
    expect(third.status).toBe(502);
    const saved = await ReportShare.findById(failedShare._id).lean();
    expect(saved).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        attempts: 3,
        failureReason: 'Could not send the email. Please try again.',
      }),
    );
    expect(saved.sharedAt).toEqual(failedShare.sharedAt);
    expect(await ReportShare.countDocuments()).toBe(1);
  });

  it('TC-49 E4: a share that failed twice and then works becomes SENT with attempts 3', async () => {
    jest.spyOn(emailService, 'send').mockRejectedValueOnce(emailDown());
    await retryShare(failedShare._id);

    const res = await retryShare(failedShare._id);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ status: 'SENT', attempts: 3, failureReason: null }),
    );
  });

  it('TC-50 E4: retrying a SENT share is 409 INVALID_SHARE_TRANSITION, and nothing is sent', async () => {
    await retryShare(failedShare._id);
    emailService.transport.clearSentEmails();

    const res = await retryShare(failedShare._id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_SHARE_TRANSITION');
    expect(res.body.error.message).toContain('SENT');
    expect(sentEmails()).toHaveLength(0);
    expect((await ReportShare.findById(failedShare._id)).attempts).toBe(2);
  });

  it('DMS-162.4: a share no one has, or an id that is not an id, is 404', async () => {
    const unknown = await retryShare(new mongoose.Types.ObjectId());
    const invalid = await retryShare('not-an-id');

    expect(unknown.status).toBe(404);
    expect(invalid.status).toBe(404);
    expect(invalid.body.error.code).toBe('NOT_FOUND');
  });

  it.each([Role.DISTRICT_OFFICER, Role.CITIZEN])(
    'DMS-162.4: a %s cannot retry a share (403)',
    async (role) => {
      const res = await retryShare(failedShare._id, await createUser({ role }));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(sentEmails()).toHaveLength(0);
    },
  );

  it('DMS-162.4: without a token the request is refused (401)', async () => {
    const res = await request(app).post(`/api/report-shares/${failedShare._id}/retry`);

    expect(res.status).toBe(401);
  });

  it('DMS-162.4: a duty officer can retry a share another officer made', async () => {
    const dutyOfficer = await createUser({ role: Role.DUTY_OFFICER });

    const res = await retryShare(failedShare._id, dutyOfficer);

    expect(res.status).toBe(200);
    expect(res.body.data.sharedBy.id).toBe(String(officer._id));
  });

  it('DMS-162.4: the shares list shows the FAILED share, then SENT after the retry', async () => {
    const list = () =>
      request(app)
        .get(`/api/post-event-reports/${report._id}/shares`)
        .set('Authorization', bearerFor(officer));

    const before = await list();
    await retryShare(failedShare._id);
    const after = await list();

    expect(before.body.data.shares.map((s) => [s.status, s.attempts])).toEqual([['FAILED', 1]]);
    expect(after.body.data.shares.map((s) => [s.status, s.attempts])).toEqual([['SENT', 2]]);
  });
});
