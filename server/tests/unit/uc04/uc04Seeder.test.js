import { jest } from '@jest/globals';
import { DistrictSeeder } from '../../../scripts/DistrictSeeder.js';
import { HazardEventSeeder } from '../../../scripts/HazardEventSeeder.js';
import { OrganisationSeeder } from '../../../scripts/OrganisationSeeder.js';
import { PeopleSeeder } from '../../../scripts/PeopleSeeder.js';
import { Uc03Seeder } from '../../../scripts/Uc03Seeder.js';
import { Uc04Seeder } from '../../../scripts/Uc04Seeder.js';
import { ReportContext } from '../../../src/domain/analysis/ReportContext.js';
import { HazardEvent as HazardEventDomain } from '../../../src/domain/events/HazardEvent.js';
import { District } from '../../../src/models/District.js';
import { HazardAlert } from '../../../src/models/HazardAlert.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { Notification } from '../../../src/models/Notification.js';
import { OccupancyRecord } from '../../../src/models/OccupancyRecord.js';
import { PostEventReport } from '../../../src/models/PostEventReport.js';
import { ReliefStock } from '../../../src/models/ReliefStock.js';
import { ReportExport } from '../../../src/models/ReportExport.js';
import { Shelter } from '../../../src/models/Shelter.js';
import { SupplyDistribution } from '../../../src/models/SupplyDistribution.js';
import { User } from '../../../src/models/User.js';
import { ReferenceNumberGenerator } from '../../../src/services/ReferenceNumberGenerator.js';
import { AlertTimelineSection } from '../../../src/services/reports/sections/AlertTimelineSection.js';
import { CitizensReachedSection } from '../../../src/services/reports/sections/CitizensReachedSection.js';
import { OccupancyOverTimeSection } from '../../../src/services/reports/sections/OccupancyOverTimeSection.js';
import { ResourceDistributionSection } from '../../../src/services/reports/sections/ResourceDistributionSection.js';

// The Kelani basin floods history (DMS-153.7) that the post-event report is
// generated from, checked through the four real report sections.
jest.setTimeout(120000);

const seedPrerequisites = async () => {
  await new DistrictSeeder().run();
  await new PeopleSeeder().run();
  await new OrganisationSeeder().run();
  await new HazardEventSeeder().run();
};

const seedAll = async () => {
  await seedPrerequisites();
  await new Uc03Seeder().run();
  await new Uc04Seeder().run();
};

const kelaniContext = async () => {
  const event = await HazardEvent.findOne({ name: 'Kelani basin floods' }).lean();
  return new ReportContext({
    event: HazardEventDomain.fromDocument(event),
    dateFrom: '2026-06-08',
    dateTo: '2026-06-20',
    districtIds: event.districts.map(String),
  });
};

const counts = async () => ({
  alerts: await HazardAlert.countDocuments(),
  deliveries: await Notification.countDocuments(),
  occupancy: await OccupancyRecord.countDocuments(),
  distributions: await SupplyDistribution.countDocuments(),
  shelters: await Shelter.countDocuments(),
  stock: await ReliefStock.countDocuments(),
});

beforeAll(async () => {
  await Notification.init();
  await HazardAlert.init();
  await User.init();
});

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Uc04Seeder', () => {
  it('DMS-153.7: is the uc04 seeder, and --reset-demo empties only the generated reports and their exports', () => {
    const seeder = new Uc04Seeder();

    expect(seeder.name).toBe('uc04');
    expect(seeder.demoModels).toEqual([PostEventReport, ReportExport]);
  });

  it('DMS-153.7: seeds the Kelani event history that the four report sections compile from', async () => {
    await seedAll();
    const ctx = await kelaniContext();

    const [timeline, reached, occupancy, distribution] = await Promise.all(
      [
        new AlertTimelineSection(),
        new CitizensReachedSection(),
        new OccupancyOverTimeSection(),
        new ResourceDistributionSection(),
      ].map((section) => section.compile(ctx)),
    );

    // 14 alerts, issued, updated and cleared, with a status change every day.
    expect(timeline.result.alerts).toBe(14);
    expect(timeline.gaps).toEqual([]);
    expect(new Set(timeline.result.entries.map((entry) => entry.status))).toEqual(
      new Set(['BROADCAST', 'UPDATED', 'CANCELLED']),
    );

    // Deliveries every day, on all three channels, some FAILED; about 94%
    // of the citizens reached, each counted once.
    expect(reached.gaps).toEqual([]);
    expect(reached.result.perChannel.every((row) => row.failed > 0)).toBe(true);
    expect(reached.result.reachedRate).toBeGreaterThan(0.9);
    expect(reached.result.reachedRate).toBeLessThan(0.97);
    const deliveredRecords = reached.result.perChannel.reduce((sum, row) => sum + row.delivered, 0);
    expect(reached.result.citizensReached).toBeLessThan(deliveredRecords);

    // Three districts, peaking together at 4,120 on 12 Jun, with the
    // deliberate 14-15 Jun gap.
    expect(occupancy.result.districts.map((row) => row.district.name)).toEqual([
      'Colombo',
      'Gampaha',
      'Kalutara',
    ]);
    const totalOn = (date) =>
      occupancy.result.districts.reduce(
        (sum, row) => sum + (row.days.find((day) => day.date === date).peak ?? 0),
        0,
      );
    expect(totalOn('2026-06-12')).toBe(4120);
    expect(ctx.days().every((day) => totalOn(day) <= 4120)).toBe(true);
    expect(occupancy.gaps.map((gap) => gap.toJSON())).toEqual([
      {
        section: 'occupancyOverTime',
        from: '2026-06-14',
        to: '2026-06-15',
        reason: 'No occupancy records',
      },
    ]);

    // Distributions every day from four organisations to three districts.
    expect(distribution.gaps).toEqual([]);
    expect(distribution.result.total).toBe(18676);
    expect(new Set(distribution.result.rows.map((row) => row.organisation.name))).toEqual(
      new Set(['Red Cross Sri Lanka', 'Government/DMC', 'ADRA', 'UNICEF Sri Lanka']),
    );
    expect(new Set(distribution.result.rows.map((row) => row.district.name)).size).toBe(3);
  });

  it('DMS-153.7: seeds HA-0001 to HA-0014, each issued, updated and cleared as versions of its own', async () => {
    await seedAll();
    const event = await HazardEvent.findOne({ name: 'Kelani basin floods' });

    const alerts = await HazardAlert.find().sort({ referenceNo: 1 }).lean();
    const first = alerts[0];

    expect(alerts.map((alert) => alert.referenceNo)).toEqual(
      Array.from({ length: 14 }, (_, i) => `HA-${String(i + 1).padStart(4, '0')}`),
    );
    expect(alerts.every((alert) => alert.status === 'CANCELLED')).toBe(true);
    expect(alerts.every((alert) => alert.event.equals(event._id))).toBe(true);
    expect(first.statusHistory.map((entry) => [entry.status, entry.version])).toEqual([
      ['DRAFT', 1],
      ['BROADCAST', 1],
      ['UPDATED', 2],
      ['CANCELLED', 3],
    ]);
    expect(first.version).toBe(3);
    expect(
      (await Notification.distinct('kind', { alert: first._id, alertVersion: 3 })).sort(),
    ).toEqual(['ALL_CLEAR']);

    // HA-0001 to HA-0014 are reserved, so the next live warning is HA-0015.
    const next = await new ReferenceNumberGenerator({
      counterName: 'hazardAlert',
      prefix: 'HA',
    }).next();

    expect(next).toBe('HA-0015');
  });

  it("DMS-153.7: leaves UC03's Gampaha shelters and stock as they were", async () => {
    await seedPrerequisites();
    await new Uc03Seeder().run();
    const gampaha = await District.findOne({ name: 'Gampaha' });
    const before = {
      shelters: await Shelter.find({ district: gampaha._id }).sort({ name: 1 }).lean(),
      stock: await ReliefStock.find({ district: gampaha._id }).sort({ _id: 1 }).lean(),
    };

    await new Uc04Seeder().run();

    expect(await Shelter.find({ district: gampaha._id }).sort({ name: 1 }).lean()).toEqual(
      before.shelters,
    );
    expect(await ReliefStock.find({ district: gampaha._id }).sort({ _id: 1 }).lean()).toEqual(
      before.stock,
    );
    const others = await Shelter.find({ district: { $ne: gampaha._id } }).lean();
    expect(others).toHaveLength(5);
    expect(others.every((shelter) => shelter.currentOccupancy === 0)).toBe(true);
  });

  it('DMS-153.7: running it twice changes nothing', async () => {
    await seedAll();
    const first = await counts();

    await new Uc04Seeder().run();

    expect(await counts()).toEqual(first);
    expect(first).toEqual(
      // UC03 adds five September distributions of its own, and five occupancy
      // records for each of its five Gampaha shelters.
      expect.objectContaining({
        alerts: 14,
        occupancy: 10 * 11 * 3 + 5 * 5,
        distributions: 3 * 4 * 13 + 5,
      }),
    );
  });

  it('DMS-153.7: refuses to overwrite a live alert that already took HA-0001', async () => {
    await seedPrerequisites();
    await new Uc03Seeder().run();
    const officer = await User.findOne({ email: 'dmc.officer@example.test' });
    await HazardAlert.create({ referenceNo: 'HA-0001', createdBy: officer._id });

    await expect(new Uc04Seeder().run()).rejects.toThrow(/HA-0001 is already a live alert/);
  });

  it('DMS-153.7: stops when UC03 or the hazard events have not been seeded', async () => {
    await seedPrerequisites();
    await expect(new Uc04Seeder().run()).rejects.toThrow(/run Uc03Seeder first/);

    await HazardEvent.deleteMany({});
    await expect(new Uc04Seeder().run()).rejects.toThrow(/run HazardEventSeeder first/);
  });
});
