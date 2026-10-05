import { jest } from '@jest/globals';
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

// UC02 main flow steps 7-9 (DMS-130.6), against the in-memory database with
// the real geography, reference counter and NotificationService; the clock
// and the delivery channel are fakes.
const BRIDGE = { latitude: 6.9382, longitude: 79.9012 }; // in Colombo's box only
const JAFFNA = { latitude: 9.6615, longitude: 80.0255 }; // in no fixture district

const validInput = (overrides = {}) => ({
  description: 'Water level rising near the bridge',
  hazardType: 'RISING_RIVER_FLOOD',
  location: BRIDGE,
  locationSource: 'GPS',
  photoUrl: 'https://example.test/hazard-reports/a.jpg',
  ...overrides,
});

// submit() answers { report, created }; most tests here only need the report.
const submitReport = async (reportService, ...args) => (await reportService.submit(...args)).report;

let clock;
let channel;
let service;
let areas;

beforeAll(async () => {
  await HazardReport.init();
});

beforeEach(async () => {
  clock = new FakeClock('2026-10-02T04:54:00.000Z');
  channel = new FakeChannel();
  service = new HazardReportService({
    clock,
    notifications: new NotificationService({ channels: [channel] }),
  });
  areas = await seedAreas();
});

const inboxOf = (user) => UserNotification.find({ user: user._id }).lean();

describe('HazardReportService.submit', () => {
  it('Main 8 (TC-01): stores the report as PENDING with a GR reference and source GPS', async () => {
    const citizen = await createUser();

    const report = await submitReport(service, citizen, validInput());

    expect(report).toMatchObject({
      referenceNo: 'GR-0001',
      status: ReportStatus.PENDING,
      locationSource: 'GPS',
      hazardType: 'RISING_RIVER_FLOOD',
      description: 'Water level rising near the bridge',
      location: BRIDGE,
      isEscalatable: false,
      reviewedBy: null,
      reviewedAt: null,
      dismissalReason: null,
      dismissalNote: null,
      clientReportId: null,
    });
    expect(await HazardReport.countDocuments()).toBe(1);
  });

  it('Main 8: stamps submittedAt from the injected clock', async () => {
    const report = await submitReport(service, await createUser(), validInput());

    expect(report.submittedAt).toEqual(new Date('2026-10-02T04:54:00.000Z'));
  });

  it('Main 8 (TC-05): derives the district from the coordinates', async () => {
    const report = await submitReport(service, await createUser(), validInput());

    expect(report.district).toEqual({ id: areas.colombo.id, name: 'Colombo' });
  });

  it('Main 8: shows the reporter as { id, role } only, never their name', async () => {
    const citizen = await createUser({ role: Role.COMMUNITY_VOLUNTEER });

    const report = await submitReport(service, citizen, validInput());

    expect(report.reporter).toEqual({ id: citizen.id, role: Role.COMMUNITY_VOLUNTEER });
  });

  it("Main 8: falls back to the reporter's home district when the point is in none", async () => {
    const citizen = await createUser({ homeDistrict: areas.gampaha });

    const report = await submitReport(service, citizen, validInput({ location: JAFFNA }));

    expect(report.district).toEqual({ id: areas.gampaha.id, name: 'Gampaha' });
  });

  it('E1: refuses a point in no district from a reporter with no home district', async () => {
    const citizen = await createUser();

    await expect(
      submitReport(service, citizen, validInput({ location: JAFFNA })),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'location', message: 'must be inside a district of Sri Lanka' }],
    });
    expect(await HazardReport.countDocuments()).toBe(0);
  });

  it('A3: keeps the clientReportId the app sent', async () => {
    const clientReportId = 'b4f0c9e2-6a1d-4c7e-9f3a-2d8e5b7a1c60';

    const report = await submitReport(service, await createUser(), validInput({ clientReportId }));

    expect(report.clientReportId).toBe(clientReportId);
  });

  it('A2 (TC-20): stores locationSource MANUAL', async () => {
    const report = await submitReport(
      service,
      await createUser(),
      validInput({ locationSource: 'MANUAL' }),
    );

    expect(report.locationSource).toBe('MANUAL');
  });

  it('Main 8 (TC-06): gives concurrent submits unique sequential references', async () => {
    const citizen = await createUser();

    const reports = await Promise.all(
      Array.from({ length: 8 }, () => submitReport(service, citizen, validInput())),
    );

    expect(reports.map((r) => r.referenceNo).sort()).toEqual(
      Array.from({ length: 8 }, (_, i) => `GR-000${i + 1}`),
    );
  });

  describe('clustering (step 7 / A4)', () => {
    it('Main 7: starts a new cluster with its own id when nothing matches', async () => {
      const report = await submitReport(service, await createUser(), validInput());

      expect(String(report.clusterId)).toBe(String(report.id));
    });

    it('A4 (TC-25): joins the cluster of a matching report 30 minutes earlier', async () => {
      const citizen = await createUser();
      const first = await submitReport(service, citizen, validInput());

      clock.advance(30 * FakeClock.MINUTE);
      const second = await submitReport(service, citizen, validInput());

      expect(String(second.clusterId)).toBe(String(first.id));
      expect(second.referenceNo).not.toBe(first.referenceNo);
    });

    it('A4 (TC-27): starts a new cluster once the 2-hour window has passed', async () => {
      const citizen = await createUser();
      const first = await submitReport(service, citizen, validInput());

      clock.advance(2 * FakeClock.HOUR + FakeClock.MINUTE);
      const second = await submitReport(service, citizen, validInput());

      expect(String(second.clusterId)).toBe(String(second.id));
      expect(String(second.clusterId)).not.toBe(String(first.clusterId));
    });

    it('A4 (TC-30): joins the oldest cluster when reports from two clusters match', async () => {
      const citizen = await createUser();
      // Two clusters 600 m apart - too far to have joined each other - both
      // within 500 m of a point between them.
      const west = await service.submit(
        citizen,
        validInput({ location: { latitude: 6.9382, longitude: 79.8985 } }),
      );
      clock.advance(10 * FakeClock.MINUTE);
      const east = await service.submit(
        citizen,
        validInput({ location: { latitude: 6.9382, longitude: 79.9039 } }),
      );
      clock.advance(10 * FakeClock.MINUTE);

      const middle = await service.submit(citizen, validInput());

      expect(String(east.clusterId)).not.toBe(String(west.clusterId));
      expect(String(middle.clusterId)).toBe(String(west.clusterId));
    });

    it('A4 (TC-29): does not join a report of a different type', async () => {
      const citizen = await createUser();
      await submitReport(service, citizen, validInput({ hazardType: 'LANDSLIDE' }));

      const second = await submitReport(service, citizen, validInput());

      expect(String(second.clusterId)).toBe(String(second.id));
    });
  });

  describe('notifying the duty officer (step 9)', () => {
    it('Main 9 (TC-07): notifies each duty officer on shift in that district, and nobody else', async () => {
      const onShift = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
      const alsoOnShift = await createUser({
        role: Role.DUTY_OFFICER,
        shiftDistrict: areas.colombo,
      });
      const elsewhere = await createUser({
        role: Role.DUTY_OFFICER,
        shiftDistrict: areas.gampaha,
      });
      const dmcOfficer = await createUser({ role: Role.DMC_OFFICER });

      const report = await submitReport(service, await createUser(), validInput());

      for (const officer of [onShift, alsoOnShift]) {
        const inbox = await inboxOf(officer);
        expect(inbox).toHaveLength(1);
        expect(inbox[0]).toMatchObject({
          type: NotificationType.REPORT_SUBMITTED,
          title: `New ground report ${report.referenceNo}`,
          body: `New ground report ${report.referenceNo} – Rising river / Flood – Colombo`,
          link: `/ground-reports/${report.id}`,
        });
      }
      expect(await inboxOf(elsewhere)).toEqual([]);
      expect(await inboxOf(dmcOfficer)).toEqual([]);
    });

    it('Main 9: notifies every DMC officer when no duty officer is on shift there', async () => {
      const dmcOfficer = await createUser({ role: Role.DMC_OFFICER });
      const otherDuty = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.gampaha });
      const citizen = await createUser();

      await submitReport(service, citizen, validInput());

      expect(await inboxOf(dmcOfficer)).toHaveLength(1);
      expect(await inboxOf(otherDuty)).toHaveLength(1);
      expect(await inboxOf(citizen)).toEqual([]);
    });

    it('Main 9 (TC-08): still stores and returns the report when the channel fails', async () => {
      await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
      channel.willReturn([new Error('push gateway down')]);

      const report = await submitReport(service, await createUser(), validInput());

      expect(report.status).toBe(ReportStatus.PENDING);
      expect(await HazardReport.countDocuments()).toBe(1);
      expect(channel.calls).toHaveLength(1);
    });

    it('Main 9 (TC-08): still stores and returns the report when notifying throws', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const failing = new HazardReportService({
        clock,
        notifications: { notifyRole: jest.fn().mockRejectedValue(new Error('db down')) },
      });

      const report = await submitReport(failing, await createUser(), validInput());

      expect(report.referenceNo).toBe('GR-0001');
      expect(await HazardReport.countDocuments()).toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        'Could not notify officers about GR-0001:',
        'db down',
      );
      jest.restoreAllMocks();
    });
  });
});

describe('resend (A3, DMS-134.4)', () => {
  const clientReportId = 'b4f0c9e2-6a1d-4c7e-9f3a-2d8e5b7a1c60';

  it('A3: answers created true, then created false with the same report', async () => {
    const citizen = await createUser();

    const first = await service.submit(citizen, validInput({ clientReportId }));
    const second = await service.submit(citizen, validInput({ clientReportId }));

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.report.id).toEqual(first.report.id);
  });

  it('A3: a copy that loses the race at the unique index returns the stored report', async () => {
    const citizen = await createUser();
    const create = HazardReport.create.bind(HazardReport);
    // The other copy lands between this one's lookup and its insert.
    jest.spyOn(HazardReport, 'create').mockImplementationOnce(async (fields) => {
      await create({ ...fields, _id: undefined, referenceNo: 'GR-9999' });
      return create(fields);
    });

    const result = await service.submit(citizen, validInput({ clientReportId }));

    expect(result.created).toBe(false);
    expect(result.report.referenceNo).toBe('GR-9999');
    expect(await HazardReport.countDocuments()).toBe(1);
    jest.restoreAllMocks();
  });
});
