import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { PostEventReport } from '../../src/models/PostEventReport.js';
import { ReportExport } from '../../src/models/ReportExport.js';
import { PdfReportExporter } from '../../src/services/reports/exporters/PdfReportExporter.js';
import { storageService } from '../../src/services/StorageService.js';
import { ApiError } from '../../src/utils/ApiError.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC04 main flow steps 12-13 (DMS-154, contract §14.8): exporting a stored
// Kelani report as PDF or CSV, and E3 when that fails (DMS-161). Storage is faked, so each upload is recorded
// here instead of reaching Supabase.
let areas;
let officer;
let report;
let uploads;

const seedReport = async () => {
  areas = await seedAreas();
  officer = await createUser({ role: Role.DMC_OFFICER, name: 'Ruwan Jayasinghe' });
  const event = await HazardEvent.create({
    name: 'Kelani basin floods',
    hazardType: 'FLOOD',
    status: 'CLOSED',
    startDate: new Date('2026-06-08'),
    endDate: new Date('2026-06-20'),
    districts: [areas.colombo._id, areas.gampaha._id],
  });
  report = await PostEventReport.create({
    event: event._id,
    generatedBy: officer._id,
    generatedAt: new Date('2026-10-06T09:00:00.000Z'),
    dateFrom: '2026-06-13',
    dateTo: '2026-06-15',
    districts: [areas.colombo._id, areas.gampaha._id],
    summary: { peakOccupancy: 450, peakOccupancyDate: '2026-06-13' },
    sections: [
      {
        key: 'occupancyOverTime',
        result: {
          districts: [
            {
              district: { id: String(areas.colombo._id), name: 'Colombo' },
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
  });
};

const exportReport = (id, body, user = officer) =>
  request(app)
    .post(`/api/post-event-reports/${id}/exports`)
    .set('Authorization', bearerFor(user))
    .send(body);

beforeEach(async () => {
  await seedReport();
  uploads = [];
  jest.spyOn(storageService, 'storeFile').mockImplementation(async (file, mimeType, folder) => {
    uploads.push({ file, mimeType, folder });
    return `https://storage.example/${folder}/${uploads.length}`;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/post-event-reports/:id/exports — access', () => {
  it.each([Role.DISTRICT_OFFICER, Role.CITIZEN])(
    'TC-01 Main 12: a %s cannot export a report (403)',
    async (role) => {
      const res = await exportReport(report._id, { format: 'PDF' }, await createUser({ role }));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(uploads).toHaveLength(0);
    },
  );

  it('TC-01 Main 12: without a token the request is refused (401)', async () => {
    const res = await request(app)
      .post(`/api/post-event-reports/${report._id}/exports`)
      .send({ format: 'PDF' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_HEADER_MISSING');
  });

  it('DMS-154.4: a duty officer can export a report another officer generated', async () => {
    const dutyOfficer = await createUser({ role: Role.DUTY_OFFICER });

    const res = await exportReport(report._id, { format: 'CSV' }, dutyOfficer);

    expect(res.status).toBe(201);
    expect((await ReportExport.findOne()).createdBy).toEqual(dutyOfficer._id);
  });
});

describe('POST /api/post-event-reports/:id/exports — exporting', () => {
  it('TC-19 Main 12-13: exporting as CSV stores a ReportExport and flags the gap rows', async () => {
    const res = await exportReport(report._id, { format: 'CSV' });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      exportId: expect.any(String),
      format: 'CSV',
      fileUrl: 'https://storage.example/reports/1',
      createdAt: expect.any(String),
    });
    const saved = await ReportExport.findById(res.body.data.exportId).lean();
    expect(saved).toEqual(
      expect.objectContaining({
        report: report._id,
        format: 'CSV',
        fileUrl: 'https://storage.example/reports/1',
        createdBy: officer._id,
      }),
    );
    const lines = uploads[0].file.toString('utf8').split('\r\n');
    expect(lines).toEqual(
      expect.arrayContaining([
        'summary,2026-06-13,,,peakOccupancy,450,true',
        'occupancyOverTime,2026-06-13,Colombo,,peak,450,false',
        'occupancyOverTime,2026-06-14,Colombo,,peak,,true',
        'occupancyOverTime,2026-06-15,Colombo,,peak,,true',
      ]),
    );
  });

  it('TC-20 Main 12-13: exporting as PDF uploads a non-empty PDF', async () => {
    const res = await exportReport(report._id, { format: 'PDF' });

    expect(res.status).toBe(201);
    expect(res.body.data.format).toBe('PDF');
    expect(uploads).toHaveLength(1);
    expect(uploads[0].file.length).toBeGreaterThan(1000);
    expect(uploads[0].file.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it.each([
    ['PDF', 'application/pdf'],
    ['CSV', 'text/csv'],
  ])('TC-21 Main 13: a %s file is uploaded to the reports/ folder as %s', async (format, type) => {
    await exportReport(report._id, { format });

    expect(uploads.map(({ mimeType, folder }) => [mimeType, folder])).toEqual([[type, 'reports']]);
  });

  it('DMS-154.4: exporting the same format twice keeps both exports and both files', async () => {
    const first = await exportReport(report._id, { format: 'PDF' });
    const second = await exportReport(report._id, { format: 'PDF' });

    expect(second.status).toBe(201);
    expect(second.body.data.exportId).not.toBe(first.body.data.exportId);
    expect(second.body.data.fileUrl).not.toBe(first.body.data.fileUrl);
    expect(await ReportExport.countDocuments({ report: report._id, format: 'PDF' })).toBe(2);
  });

  it('DMS-154.4: exporting leaves the stored report as it was', async () => {
    const before = await PostEventReport.findById(report._id).lean();

    await exportReport(report._id, { format: 'CSV' });

    expect(await PostEventReport.findById(report._id).lean()).toEqual(before);
  });
});

describe('POST /api/post-event-reports/:id/exports — refused', () => {
  it.each([
    [{ format: 'XLSX' }, 'must be one of [PDF, CSV]'],
    [{ format: 'pdf' }, 'must be one of [PDF, CSV]'],
    [{}, 'format is required'],
  ])('TC-22 Main 12: %j is refused on format (400)', async (body, message) => {
    const res = await exportReport(report._id, body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([{ field: 'format', message }]);
    expect(uploads).toHaveLength(0);
    expect(await ReportExport.countDocuments()).toBe(0);
  });

  it.each([
    ['an unknown', () => String(new mongoose.Types.ObjectId())],
    ['a malformed', () => 'not-an-id'],
  ])('TC-23 Main 12: %s report id is 404, and nothing is uploaded', async (_kind, id) => {
    const res = await exportReport(id(), { format: 'CSV' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(uploads).toHaveLength(0);
    expect(await ReportExport.countDocuments()).toBe(0);
  });
});

describe('POST /api/post-event-reports/:id/exports — E3 export failure', () => {
  const storageDown = () =>
    new ApiError(502, 'STORAGE_UNAVAILABLE', 'Could not upload the file. Please try again.');

  it('TC-44 E3: when the file cannot be written, 500 EXPORT_FAILED and no ReportExport', async () => {
    jest
      .spyOn(PdfReportExporter.prototype, 'write')
      .mockRejectedValueOnce(new Error('pdfkit failed'));

    const res = await exportReport(report._id, { format: 'PDF' });

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({
      code: 'EXPORT_FAILED',
      message: 'The export file could not be created. Please try again.',
    });
    expect(uploads).toHaveLength(0);
    expect(await ReportExport.countDocuments()).toBe(0);
  });

  it('TC-45 E3: when storage fails, 502 STORAGE_UNAVAILABLE and no ReportExport', async () => {
    storageService.storeFile.mockRejectedValueOnce(storageDown());

    const res = await exportReport(report._id, { format: 'CSV' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('STORAGE_UNAVAILABLE');
    expect(await ReportExport.countDocuments()).toBe(0);
  });

  it('TC-46 E3: retrying the same request after a failure answers 201, and the report is unchanged', async () => {
    const before = await PostEventReport.findById(report._id).lean();
    storageService.storeFile.mockRejectedValueOnce(storageDown());
    expect((await exportReport(report._id, { format: 'CSV' })).status).toBe(502);

    const retry = await exportReport(report._id, { format: 'CSV' });

    expect(retry.status).toBe(201);
    expect(await ReportExport.countDocuments({ report: report._id })).toBe(1);
    expect(await PostEventReport.findById(report._id).lean()).toEqual(before);
  });
});
