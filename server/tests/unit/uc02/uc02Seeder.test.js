import { jest } from '@jest/globals';
import { DistrictSeeder } from '../../../scripts/DistrictSeeder.js';
import { PeopleSeeder } from '../../../scripts/PeopleSeeder.js';
import { Uc02Seeder } from '../../../scripts/Uc02Seeder.js';
import { ReportStatus } from '../../../src/enums/ReportStatus.js';
import { District } from '../../../src/models/District.js';
import { HazardReport } from '../../../src/models/HazardReport.js';
import { User } from '../../../src/models/User.js';
import { ReferenceNumberGenerator } from '../../../src/services/ReferenceNumberGenerator.js';
import { FakeClock } from '../../helpers/FakeClock.js';

// The UC02 demo queue (DMS-130.10): the §5.2 wireframe's four rows, the first
// of them a three-report Flood cluster.
const NOW = '2026-10-02T04:54:00.000Z';

beforeAll(async () => {
  await HazardReport.init();
  await User.init();
});

beforeEach(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  await new DistrictSeeder().run();
  await new PeopleSeeder().run();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const seed = () => new Uc02Seeder({ clock: new FakeClock(NOW) }).run();
const byRef = async () =>
  Object.fromEntries(
    (await HazardReport.find().lean()).map((report) => [report.referenceNo, report]),
  );

describe('Uc02Seeder', () => {
  it('Main 10: seeds six PENDING reports in Colombo, all GPS', async () => {
    await seed();

    const reports = await HazardReport.find().lean();
    const colombo = await District.findOne({ name: 'Colombo' });
    expect(reports).toHaveLength(6);
    expect(reports.every((r) => r.status === ReportStatus.PENDING)).toBe(true);
    expect(reports.every((r) => r.district.equals(colombo._id))).toBe(true);
    expect(reports.every((r) => r.locationSource === 'GPS')).toBe(true);
  });

  it('A4: puts GR-2474, GR-2478 and GR-2481 in one Flood cluster led by GR-2474', async () => {
    await seed();
    const reports = await byRef();

    for (const ref of ['GR-2474', 'GR-2478', 'GR-2481']) {
      expect(reports[ref].clusterId).toEqual(reports['GR-2474']._id);
      expect(reports[ref].hazardType).toBe('RISING_RIVER_FLOOD');
    }
  });

  it('Main 10: gives the wireframe its four queue rows, one per type', async () => {
    await seed();
    const reports = await byRef();

    for (const [ref, type] of [
      ['GR-2470', 'OTHER'],
      ['GR-2476', 'BLOCKED_ROAD'],
      ['GR-2479', 'LANDSLIDE'],
    ]) {
      expect(reports[ref].hazardType).toBe(type);
      expect(reports[ref].clusterId).toEqual(reports[ref]._id);
    }
    expect(new Set(Object.values(reports).map((r) => String(r.clusterId))).size).toBe(4);
  });

  it('Main 8: dates the reports back from the clock, GR-2481 newest', async () => {
    await seed();
    const reports = await byRef();

    expect(reports['GR-2481'].submittedAt).toEqual(new Date('2026-10-02T04:48:00.000Z'));
    expect(reports['GR-2470'].submittedAt).toEqual(new Date('2026-10-01T23:54:00.000Z'));
  });

  it('Main 8: has GR-2481 submitted by the demo citizen', async () => {
    await seed();
    const citizen = await User.findOne({ email: 'citizen@example.test' });

    expect((await byRef())['GR-2481'].reporter).toEqual(citizen._id);
  });

  it('Main 8: moves the reference counter past the seeded numbers', async () => {
    await seed();

    expect(await new ReferenceNumberGenerator().next()).toBe('GR-2482');
  });

  it('is idempotent and leaves a reviewed report as it is', async () => {
    await seed();
    await HazardReport.updateOne({ referenceNo: 'GR-2479' }, { status: ReportStatus.CONFIRMED });
    const before = await byRef();

    await seed();
    const after = await byRef();

    expect(Object.keys(after)).toHaveLength(6);
    expect(after['GR-2479'].status).toBe(ReportStatus.CONFIRMED);
    for (const ref of Object.keys(before)) {
      expect(after[ref]._id).toEqual(before[ref]._id);
      expect(after[ref].clusterId).toEqual(before[ref].clusterId);
    }
  });

  it('DMS-110: is selected as uc02 and lets --reset-demo empty only the reports', () => {
    const seeder = new Uc02Seeder();

    expect(seeder.name).toBe('uc02');
    expect(seeder.demoModels).toEqual([HazardReport]);
  });

  it('DMS-110: gives each seeded report a fixed id, so a reset reseed keeps it', async () => {
    await seed();
    const before = await byRef();
    await HazardReport.deleteMany({});

    await seed();
    const after = await byRef();

    expect(String(after['GR-2481']._id)).toBe('66f9a0c1b2c3d4e5f6a72481');
    for (const ref of Object.keys(before)) {
      expect(after[ref]._id).toEqual(before[ref]._id);
      expect(after[ref].clusterId).toEqual(before[ref].clusterId);
    }
  });

  it('stops when the districts have not been seeded', async () => {
    await District.deleteMany({});

    await expect(seed()).rejects.toThrow('run DistrictSeeder first');
    expect(await HazardReport.countDocuments()).toBe(0);
  });

  it('stops when a reporter has not been seeded', async () => {
    await User.deleteOne({ email: 'citizen@example.test' });

    await expect(seed()).rejects.toThrow('"citizen@example.test" is not seeded');
    expect(await HazardReport.countDocuments()).toBe(0);
  });
});
