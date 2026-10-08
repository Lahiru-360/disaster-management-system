import { ReportBuilder } from '../../../src/services/reports/ReportBuilder.js';
import { ReportSection } from '../../../src/services/reports/ReportSection.js';
import { AlertTimelineSection } from '../../../src/services/reports/sections/AlertTimelineSection.js';
import { CitizensReachedSection } from '../../../src/services/reports/sections/CitizensReachedSection.js';
import { OccupancyOverTimeSection } from '../../../src/services/reports/sections/OccupancyOverTimeSection.js';
import { ResourceDistributionSection } from '../../../src/services/reports/sections/ResourceDistributionSection.js';
import { D, kelaniContext } from './reportFixtures.js';

// The A1 filters (DMS-156.2, contract §14.12) in the ReportContext, in what
// each section honours, and in how the builder hands them out.
const ALL_FILTERS = { hazardType: 'FLOOD', districtId: D.gampaha, organisationId: 'o-un' };

// A section that records the context it was compiled against.
class RecordingSection extends ReportSection {
  constructor(key, honoured) {
    super();
    this.fakeKey = key;
    this.honoured = honoured;
    this.seen = null;
  }

  get key() {
    return this.fakeKey;
  }

  get gapReason() {
    return `No ${this.fakeKey} records`;
  }

  get honouredFilters() {
    return this.honoured ?? super.honouredFilters;
  }

  async compile(ctx) {
    this.seen = ctx;
    return { result: {}, isEmpty: false, gaps: [] };
  }
}

describe('ReportContext — A1 filters', () => {
  it('TC-29 A1: a district filter narrows the districts every section covers to that one', () => {
    const ctx = kelaniContext({ filters: { districtId: D.gampaha } });

    expect(ctx.districtIds).toEqual([D.gampaha]);
    expect(ctx.selectedDistrictIds).toEqual([D.colombo, D.gampaha, D.kalutara]);
    expect(ctx.includesDistrict(D.gampaha)).toBe(true);
    expect(ctx.includesDistrict(D.colombo)).toBe(false);
  });

  it('DMS-156.2: without a district filter the sections cover the whole selection', () => {
    const ctx = kelaniContext();

    expect(ctx.districtIds).toEqual(ctx.selectedDistrictIds);
    expect(ctx.filters).toEqual({ hazardType: null, districtId: null, organisationId: null });
  });

  it('DMS-156.2: refuses a district filter outside the selection', () => {
    expect(() =>
      kelaniContext({ districtIds: [D.colombo], filters: { districtId: D.gampaha } }),
    ).toThrow('ReportContext districtId filter must be one of the selected districts');
  });

  it('DMS-156.2: withFilters keeps the selection and only the named filters', () => {
    const ctx = kelaniContext({ filters: ALL_FILTERS });

    const narrowed = ctx.withFilters(['districtId', 'organisationId']);

    expect(narrowed.filters).toEqual({
      hazardType: null,
      districtId: D.gampaha,
      organisationId: 'o-un',
    });
    expect(narrowed.selectedDistrictIds).toEqual(ctx.selectedDistrictIds);
    expect([narrowed.dateFrom, narrowed.dateTo, narrowed.event]).toEqual([
      ctx.dateFrom,
      ctx.dateTo,
      ctx.event,
    ]);
    expect(ctx.withFilters([]).districtIds).toEqual(ctx.selectedDistrictIds);
  });
});

describe('ReportSection — the filters each section honours', () => {
  it.each([
    [new AlertTimelineSection(), ['districtId', 'hazardType']],
    [new CitizensReachedSection(), ['districtId', 'hazardType']],
    [new OccupancyOverTimeSection(), ['districtId']],
    [new ResourceDistributionSection(), ['districtId', 'organisationId']],
  ])('DMS-156.2: %o honours %j', (section, filters) => {
    expect(section.honouredFilters).toEqual(filters);
  });

  it('DMS-156.2: a section honours the district filter unless it says otherwise', () => {
    expect(new RecordingSection('extra').honouredFilters).toEqual(['districtId']);
  });
});

describe('ReportBuilder — A1 filters', () => {
  it('TC-30 A1: each section is compiled with only the filters it honours', async () => {
    const timeline = new RecordingSection('alertTimeline', ['districtId', 'hazardType']);
    const occupancy = new RecordingSection('occupancyOverTime');
    const distribution = new RecordingSection('resourceDistribution', [
      'districtId',
      'organisationId',
    ]);
    const builder = new ReportBuilder({ sections: [timeline, occupancy, distribution] });

    await builder.build(kelaniContext({ filters: ALL_FILTERS }), {
      sectionKeys: ['alertTimeline', 'occupancyOverTime', 'resourceDistribution'],
      generatedBy: 'u',
    });

    expect(timeline.seen.filters).toEqual({
      hazardType: 'FLOOD',
      districtId: D.gampaha,
      organisationId: null,
    });
    expect(occupancy.seen.filters).toEqual({
      hazardType: null,
      districtId: D.gampaha,
      organisationId: null,
    });
    expect(distribution.seen.filters).toEqual({
      hazardType: null,
      districtId: D.gampaha,
      organisationId: 'o-un',
    });
    expect(occupancy.seen.districtIds).toEqual([D.gampaha]);
  });

  it("DMS-156.2: the report keeps the selection's districts when a district filter is set", async () => {
    const { report } = await new ReportBuilder({
      sections: [new RecordingSection('occupancyOverTime')],
    }).build(kelaniContext({ filters: { districtId: D.gampaha } }), {
      sectionKeys: ['occupancyOverTime'],
      generatedBy: 'u',
    });

    expect(report.districts).toEqual([D.colombo, D.gampaha, D.kalutara]);
  });
});
