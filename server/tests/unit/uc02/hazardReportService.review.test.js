import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { Coordinates } from '../../../src/domain/reports/Coordinates.js';
import { ReportAlreadyReviewedError } from '../../../src/domain/reports/ReportAlreadyReviewedError.js';
import { NotificationType } from '../../../src/enums/NotificationType.js';
import { ReportStatus } from '../../../src/enums/ReportStatus.js';
import { Role } from '../../../src/enums/Role.js';
import { HazardReport } from '../../../src/models/HazardReport.js';
import { UserNotification } from '../../../src/models/UserNotification.js';
import { HazardReportService } from '../../../src/services/HazardReportService.js';
import { NotificationService } from '../../../src/services/NotificationService.js';
import { FakeChannel } from '../../helpers/FakeChannel.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

// UC02 main flow steps 10-15 and the reporter's list (DMS-131.2): the queue,
// the detail, X-1 findById, confirm and listMine.
const REVIEWED_AT = new Date('2026-10-02T05:01:00.000Z');

let clock;
let service;
let areas;
let citizen;
let officer;
let sequence;

beforeAll(async () => {
  await HazardReport.init();
});

beforeEach(async () => {
  clock = new FakeClock(REVIEWED_AT);
  service = new HazardReportService({
    clock,
    notifications: new NotificationService({ channels: [new FakeChannel()] }),
  });
  areas = await seedAreas();
  citizen = await createUser();
  officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
  sequence = 0;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// A stored report; `minutesAgo` is before REVIEWED_AT, `cluster` another report to join.
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
    submittedAt: new Date(REVIEWED_AT.getTime() - minutesAgo * 60 * 1000),
    clusterId: cluster ? cluster.clusterId : id,
  });
};

describe('HazardReportService.getPendingByDistrict (step 10)', () => {
  it('Main 10 (TC-09): lists only PENDING reports of the officer’s district, grouped by cluster', async () => {
    const lead = await storeReport({ minutesAgo: 50 });
    const joined = await storeReport({ minutesAgo: 6, cluster: lead });
    const alone = await storeReport({ minutesAgo: 20, hazardType: 'LANDSLIDE' });
    await storeReport({ status: ReportStatus.CONFIRMED });
    await storeReport({ district: areas.gampaha });

    const clusters = await service.getPendingByDistrict(officer);

    expect(clusters).toEqual([
      {
        clusterId: lead.id,
        count: 2,
        reports: [
          expect.objectContaining({ referenceNo: joined.referenceNo }),
          expect.objectContaining({ referenceNo: lead.referenceNo }),
        ],
      },
      {
        clusterId: alone.id,
        count: 1,
        reports: [expect.objectContaining({ referenceNo: alone.referenceNo })],
      },
    ]);
  });

  it('Main 10: gives each report in the queue the full contract shape', async () => {
    await storeReport();

    const [{ reports }] = await service.getPendingByDistrict(officer);

    expect(reports[0]).toMatchObject({
      district: { id: areas.colombo.id, name: 'Colombo' },
      reporter: { id: citizen.id, role: Role.CITIZEN },
      isEscalatable: false,
      location: { latitude: 6.9382, longitude: 79.9012 },
    });
  });

  it('Main 10: is empty for an officer with no shiftDistrict', async () => {
    await storeReport();
    const offShift = await createUser({ role: Role.DUTY_OFFICER });

    expect(await service.getPendingByDistrict(offShift)).toEqual([]);
  });

  it('Main 10: is empty when there are no pending reports', async () => {
    expect(await service.getPendingByDistrict(officer)).toEqual([]);
  });
});

describe('HazardReportService.getDetail (step 11)', () => {
  it('Main 11: returns the report and the rest of its cluster, oldest first, every status', async () => {
    const lead = await storeReport({ minutesAgo: 50 });
    const reviewed = await storeReport({
      minutesAgo: 30,
      cluster: lead,
      status: ReportStatus.DISMISSED,
    });
    const latest = await storeReport({ minutesAgo: 6, cluster: lead });

    const { report, cluster } = await service.getDetail(latest.id, officer);

    expect(report.referenceNo).toBe(latest.referenceNo);
    expect(cluster).toEqual({
      clusterId: lead.id,
      count: 3,
      others: [
        {
          id: lead.id,
          referenceNo: lead.referenceNo,
          status: 'PENDING',
          submittedAt: lead.submittedAt,
        },
        {
          id: reviewed.id,
          referenceNo: reviewed.referenceNo,
          status: 'DISMISSED',
          submittedAt: reviewed.submittedAt,
        },
      ],
    });
  });

  it('Main 11: a report alone in its cluster has count 1 and no others', async () => {
    const alone = await storeReport();

    const { cluster } = await service.getDetail(alone.id, officer);

    expect(cluster).toEqual({ clusterId: alone.id, count: 1, others: [] });
  });

  it.each([
    ['in another district', async () => (await storeReport({ district: areas.gampaha })).id],
    ['unknown', async () => new mongoose.Types.ObjectId().toString()],
    ['malformed', async () => 'not-an-id'],
  ])('Main 11 (TC-11): a report %s is 404 NOT_FOUND', async (_label, idOf) => {
    await expect(service.getDetail(await idOf(), officer)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Hazard report not found.',
    });
  });

  it('Main 11: an officer with no shiftDistrict sees no report', async () => {
    const report = await storeReport();
    const offShift = await createUser({ role: Role.DUTY_OFFICER });

    await expect(service.getDetail(report.id, offShift)).rejects.toMatchObject({ status: 404 });
  });
});

describe('HazardReportService.findById (X-1 for UC01)', () => {
  it('X-1: returns what escalation needs, from any district', async () => {
    const report = await storeReport({ district: areas.gampaha, status: ReportStatus.CONFIRMED });

    expect(await service.findById(report.id)).toEqual({
      id: report.id,
      referenceNo: report.referenceNo,
      hazardType: 'RISING_RIVER_FLOOD',
      location: { latitude: 6.9382, longitude: 79.9012 },
      district: { id: areas.gampaha.id, name: 'Gampaha' },
      status: 'CONFIRMED',
      isEscalatable: true,
    });
  });

  it('X-1: a PENDING report is not escalatable', async () => {
    const report = await storeReport();

    expect((await service.findById(report.id)).isEscalatable).toBe(false);
  });

  it.each([new mongoose.Types.ObjectId().toString(), 'not-an-id'])(
    'X-1: returns null for id %s',
    async (id) => {
      expect(await service.findById(id)).toBeNull();
    },
  );
});

describe('HazardReportService.confirm (steps 12-14)', () => {
  it('Main 12-13 (TC-12): sets CONFIRMED, the reviewer and the time; escalatable', async () => {
    const pending = await storeReport();

    const report = await service.confirm(pending.id, officer);

    expect(report).toMatchObject({
      status: 'CONFIRMED',
      reviewedBy: { id: officer.id, name: officer.name },
      reviewedAt: REVIEWED_AT,
      isEscalatable: true,
    });
    const stored = await HazardReport.findById(pending.id);
    expect(stored.status).toBe('CONFIRMED');
    expect(stored.reviewedBy).toEqual(officer._id);
    expect(stored.reviewedAt).toEqual(REVIEWED_AT);
  });

  it('Main 13 (TC-13): creates no hazard alert and changes no warning', async () => {
    const pending = await storeReport();

    await service.confirm(pending.id, officer);

    expect(await mongoose.connection.db.collection('hazardalerts').countDocuments()).toBe(0);
  });

  it('Main 14 (TC-14): tells the reporter their report was confirmed', async () => {
    const pending = await storeReport();

    await service.confirm(pending.id, officer);

    const inbox = await UserNotification.find({ user: citizen._id }).lean();
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      type: NotificationType.REPORT_CONFIRMED,
      title: `Report ${pending.referenceNo} confirmed`,
      body: `Your report ${pending.referenceNo} was confirmed by the duty officer. Thank you.`,
      link: `/my-reports/${pending.id}`,
    });
  });

  it('Main 14: still confirms when telling the reporter fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const failing = new HazardReportService({
      clock,
      notifications: { notifyUser: jest.fn().mockRejectedValue(new Error('inbox down')) },
    });
    const pending = await storeReport();

    const report = await failing.confirm(pending.id, officer);

    expect(report.status).toBe('CONFIRMED');
    expect(console.error).toHaveBeenCalledWith(
      `Could not notify the reporter of ${pending.referenceNo}:`,
      'inbox down',
    );
  });

  it.each([ReportStatus.CONFIRMED, ReportStatus.DISMISSED])(
    'E3: refuses to confirm a %s report and leaves it as it was',
    async (status) => {
      const reviewed = await storeReport({ status });

      await expect(service.confirm(reviewed.id, officer)).rejects.toBeInstanceOf(
        ReportAlreadyReviewedError,
      );
      expect((await HazardReport.findById(reviewed.id)).status).toBe(status);
      expect(await UserNotification.countDocuments()).toBe(0);
    },
  );

  it('Main 12: a report in another district is 404 and stays PENDING', async () => {
    const elsewhere = await storeReport({ district: areas.gampaha });

    await expect(service.confirm(elsewhere.id, officer)).rejects.toMatchObject({ status: 404 });
    expect((await HazardReport.findById(elsewhere.id)).status).toBe('PENDING');
  });
});

describe('HazardReportService.listMine', () => {
  it('Main (TC-15): lists only the reporter’s own reports, every status, newest first', async () => {
    const someoneElse = await createUser();
    const older = await storeReport({ minutesAgo: 90, status: ReportStatus.DISMISSED });
    const newer = await storeReport({ minutesAgo: 5 });
    await storeReport({ reporter: someoneElse });

    const reports = await service.listMine(citizen);

    expect(reports.map((r) => r.referenceNo)).toEqual([newer.referenceNo, older.referenceNo]);
    expect(reports[1].status).toBe('DISMISSED');
  });

  it('Main: is empty for a reporter with no reports', async () => {
    expect(await service.listMine(citizen)).toEqual([]);
  });
});
