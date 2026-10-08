import { jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { PostEventReport } from '../../src/models/PostEventReport.js';
import { ReportExport } from '../../src/models/ReportExport.js';
import { ReportShare } from '../../src/models/ReportShare.js';
import { emailService } from '../../src/services/EmailService.js';
import { storageService } from '../../src/services/StorageService.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC04 A2 (DMS-157, step 14): the officer downloads the file and ends the use
// case without sharing. Done is only the web closing the report view, so on
// the server an export must leave exactly one ReportExport, no ReportShare and
// no email behind. Storage is faked, so no file reaches Supabase.
let officer;
let report;

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
    summary: { peakOccupancy: 450, peakOccupancyDate: '2026-06-13' },
    sections: [
      {
        key: 'occupancyOverTime',
        result: {
          districts: [
            {
              district: { id: String(areas.colombo._id), name: 'Colombo' },
              days: [{ date: '2026-06-13', peak: 450 }],
              peak: { value: 450, date: '2026-06-13' },
            },
          ],
        },
      },
    ],
    gaps: [],
  });
  emailService.transport.clearSentEmails();
  jest
    .spyOn(storageService, 'storeFile')
    .mockImplementation(async (file, mimeType, folder) => `https://storage.example/${folder}/f`);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const exportAs = (format) =>
  request(app)
    .post(`/api/post-event-reports/${report._id}/exports`)
    .set('Authorization', bearerFor(officer))
    .send({ format });

describe('UC04 A2: export without sharing', () => {
  it.each(['PDF', 'CSV'])(
    'TC-33 A2: exporting as %s and stopping leaves one ReportExport, no ReportShare and no email',
    async (format) => {
      const res = await exportAs(format);

      expect(res.status).toBe(201);
      expect(await ReportExport.countDocuments({ report: report._id })).toBe(1);
      expect(await ReportShare.countDocuments()).toBe(0);
      expect(emailService.transport.getSentEmails()).toHaveLength(0);
    },
  );

  it('TC-33 A2: the report lists no shares after an export', async () => {
    await exportAs('PDF');

    const res = await request(app)
      .get(`/api/post-event-reports/${report._id}/shares`)
      .set('Authorization', bearerFor(officer));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ shares: [] });
  });

  it('TC-33 A2: the stored report is unchanged by exporting it', async () => {
    const before = await PostEventReport.findById(report._id).lean();

    await exportAs('CSV');

    expect(await PostEventReport.findById(report._id).lean()).toEqual(before);
    expect(await PostEventReport.countDocuments()).toBe(1);
  });
});
