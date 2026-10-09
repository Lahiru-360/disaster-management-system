import { jest } from '@jest/globals';
import { DataGap } from '../../../src/domain/analysis/DataGap.js';
import { PostEventReport } from '../../../src/domain/analysis/PostEventReport.js';
import { ReportBuilder } from '../../../src/services/reports/ReportBuilder.js';
import { ReportSection } from '../../../src/services/reports/ReportSection.js';
import { AlertTimelineSection } from '../../../src/services/reports/sections/AlertTimelineSection.js';
import { CitizensReachedSection } from '../../../src/services/reports/sections/CitizensReachedSection.js';
import { OccupancyOverTimeSection } from '../../../src/services/reports/sections/OccupancyOverTimeSection.js';
import { ResourceDistributionSection } from '../../../src/services/reports/sections/ResourceDistributionSection.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { D, at, fakeNames, kelaniContext } from './reportFixtures.js';

const NOW = '2026-10-06T09:00:00.000Z';
const ALL = ['alertTimeline', 'citizensReached', 'occupancyOverTime', 'resourceDistribution'];

// A section that records the contexts it was compiled with.
class FakeSection extends ReportSection {
  constructor(key, { result = { key }, gaps = [], summary = {}, isEmpty = false } = {}) {
    super();
    this.fakeKey = key;
    this.output = { result, isEmpty, gaps };
    this.summary = summary;
    this.contexts = [];
  }

  get key() {
    return this.fakeKey;
  }

  get gapReason() {
    return `No ${this.fakeKey} records`;
  }

  async compile(ctx) {
    this.contexts.push(ctx);
    return this.output;
  }

  summarise() {
    return this.summary;
  }
}

// The four real sections over small fixed datasets.
const realSections = () => {
  const alert = {
    id: 'a-1',
    referenceNo: 'HA-0001',
    hazardType: 'FLOOD',
    severity: 'HIGH',
    areas: [],
    history: [{ status: 'BROADCAST', version: 1, at: at(9), severity: null, areas: null }],
  };
  const alerts = { findForReport: async () => [alert] };
  const delivery = (citizen, channel, status) => ({
    alert: 'a-1',
    citizen,
    channel,
    status,
    sentAt: at(9),
  });
  const occupancy = (shelter, district, occupants, day) => ({
    shelter,
    district,
    occupants,
    recordedAt: at(day),
  });
  return [
    new AlertTimelineSection({ alerts }),
    new CitizensReachedSection({
      alerts,
      deliveries: {
        findSent: async () => [
          delivery('c1', 'PUSH', 'DELIVERED'),
          delivery('c1', 'SMS', 'DELIVERED'),
          delivery('c2', 'SMS', 'DELIVERED'),
          delivery('c3', 'SMS', 'FAILED'),
        ],
      },
    }),
    new OccupancyOverTimeSection({
      names: fakeNames(),
      occupancy: {
        findLatestBefore: async () => [],
        findInRange: async () => [
          occupancy('s1', D.colombo, 300, 11),
          occupancy('s2', D.gampaha, 200, 11),
          occupancy('s1', D.colombo, 250, 12),
          occupancy('s2', D.gampaha, 400, 12),
        ],
      },
    }),
    new ResourceDistributionSection({
      names: fakeNames(),
      distributions: {
        findInRange: async () => [
          {
            district: D.colombo,
            supplyType: 'FOOD',
            organisation: 'o1',
            quantity: 40,
            distributedAt: at(9),
          },
          {
            district: D.gampaha,
            supplyType: 'WATER',
            organisation: 'o1',
            quantity: 60,
            distributedAt: at(10),
          },
        ],
      },
    }),
  ];
};

describe('ReportBuilder', () => {
  it('DMS-153.5: by default registers the four UC04 sections, in report order', () => {
    expect(new ReportBuilder().sectionKeys).toEqual(ALL);
  });

  it('TC-03 Main 6-11: builds an unsaved report about the event, range and districts, timed by the clock', async () => {
    const ctx = kelaniContext({ clock: new FakeClock(NOW) });
    const builder = new ReportBuilder({ sections: realSections() });

    const { report } = await builder.build(ctx, { sectionKeys: ALL, generatedBy: 'u-officer' });

    expect(report).toBeInstanceOf(PostEventReport);
    expect(report.reportId).toBeNull();
    expect(report.eventId).toBe('e-kelani');
    expect(report.generatedBy).toBe('u-officer');
    expect(report.generatedAt).toEqual(new Date(NOW));
    expect([report.dateFrom, report.dateTo]).toEqual(['2026-06-08', '2026-06-20']);
    expect(report.districts).toEqual([D.colombo, D.gampaha, D.kalutara]);
    expect(report.sections.map((section) => section.key)).toEqual(ALL);
  });

  it('TC-16 Main 11: the summary figures match the section totals', async () => {
    const builder = new ReportBuilder({ sections: realSections() });

    const { report, summary } = await builder.build(kelaniContext(), {
      sectionKeys: ALL,
      generatedBy: 'u-officer',
    });

    const result = (key) => report.sections.find((section) => section.key === key).result;
    expect(summary).toEqual({
      alertsIssued: result('alertTimeline').alerts,
      citizensReached: result('citizensReached').citizensReached,
      citizensTargeted: result('citizensReached').citizensTargeted,
      reachedRate: result('citizensReached').reachedRate,
      // 11 Jun: 300 + 200 = 500; 12 Jun: 250 + 400 = 650.
      peakOccupancy: 650,
      peakOccupancyDate: '2026-06-12',
      itemsDistributed: result('resourceDistribution').total,
    });
    expect(summary).toEqual(
      expect.objectContaining({
        alertsIssued: 1,
        citizensReached: 2,
        citizensTargeted: 3,
        itemsDistributed: 100,
      }),
    );
  });

  it('DMS-153.5: compiles only the requested sections, in report order, and leaves the other figures null', async () => {
    const sections = ALL.map((key) => new FakeSection(key, { summary: { [`${key}Figure`]: 1 } }));
    const builder = new ReportBuilder({ sections });

    const { report, summary } = await builder.build(kelaniContext(), {
      sectionKeys: ['resourceDistribution', 'alertTimeline'],
      generatedBy: 'u-officer',
    });

    expect(report.sections.map((section) => section.key)).toEqual([
      'alertTimeline',
      'resourceDistribution',
    ]);
    expect(sections.map((section) => section.contexts.length)).toEqual([1, 0, 0, 1]);
    expect(summary).toEqual(
      expect.objectContaining({
        alertTimelineFigure: 1,
        resourceDistributionFigure: 1,
        citizensReached: null,
        peakOccupancy: null,
      }),
    );
    expect(summary).not.toHaveProperty('citizensReachedFigure');
  });

  it('DMS-153.5: compiles every section against the same selection', async () => {
    const sections = ALL.map((key) => new FakeSection(key));
    const ctx = kelaniContext();

    await new ReportBuilder({ sections }).build(ctx, { sectionKeys: ALL, generatedBy: 'u' });

    sections.forEach((section) => {
      const [seen] = section.contexts;
      expect(seen.event).toBe(ctx.event);
      expect([seen.dateFrom, seen.dateTo]).toEqual([ctx.dateFrom, ctx.dateTo]);
      expect(seen.districtIds).toEqual(ctx.districtIds);
    });
  });

  it('DMS-153.5: collects every section’s gaps on the report', async () => {
    const gap = (section) =>
      new DataGap({
        section,
        from: '2026-06-14',
        to: '2026-06-15',
        reason: `No ${section} records`,
      });
    const sections = [
      new FakeSection('occupancyOverTime', { gaps: [gap('occupancyOverTime')] }),
      new FakeSection('resourceDistribution', { gaps: [gap('resourceDistribution')] }),
    ];

    const { report } = await new ReportBuilder({ sections }).build(kelaniContext(), {
      sectionKeys: ['occupancyOverTime', 'resourceDistribution'],
      generatedBy: 'u',
    });

    expect(report.hasGaps()).toBe(true);
    expect(report.gaps.map((g) => g.section)).toEqual([
      'occupancyOverTime',
      'resourceDistribution',
    ]);
  });

  it('TC-18 Main: a fifth section, injected, is compiled and included with no builder change', async () => {
    const weather = new FakeSection('weatherConditions', {
      result: { rainfallMm: 412 },
      summary: { wettestDay: '2026-06-11' },
    });
    const builder = new ReportBuilder({
      sections: [...realSections(), weather],
    });

    const { report, summary } = await builder.build(kelaniContext(), {
      sectionKeys: [...ALL, 'weatherConditions'],
      generatedBy: 'u-officer',
    });

    expect(builder.sectionKeys).toEqual([...ALL, 'weatherConditions']);
    expect(report.sections.at(-1)).toEqual({
      key: 'weatherConditions',
      result: { rainfallMm: 412 },
    });
    expect(summary.wettestDay).toBe('2026-06-11');
    expect(summary.alertsIssued).toBe(1);
  });

  it('DMS-153.5: refuses a section key nothing is registered for', async () => {
    const compile = jest.fn();
    const section = new FakeSection('alertTimeline');
    section.compile = compile;

    await expect(
      new ReportBuilder({ sections: [section] }).build(kelaniContext(), {
        sectionKeys: ['alertTimeline', 'weatherConditions'],
        generatedBy: 'u',
      }),
    ).rejects.toThrow('No report section registered for: weatherConditions');
    expect(compile).not.toHaveBeenCalled();
  });
});

describe('ReportBuilder all-empty detection (E2)', () => {
  const build = (sections) =>
    new ReportBuilder({ sections }).build(kelaniContext(), {
      sectionKeys: sections.map((section) => section.key),
      generatedBy: 'u',
    });

  it('DMS-160.1: a report is empty when every compiled section found no records', async () => {
    const { isEmpty } = await build(ALL.map((key) => new FakeSection(key, { isEmpty: true })));

    expect(isEmpty).toBe(true);
  });

  it('DMS-160.1: one section with records makes the report not empty', async () => {
    const sections = ALL.map(
      (key) => new FakeSection(key, { isEmpty: key !== 'resourceDistribution' }),
    );

    const { isEmpty } = await build(sections);

    expect(isEmpty).toBe(false);
  });

  it('DMS-160.1: only the requested sections count: an empty one alone is an empty report', async () => {
    const sections = [
      new FakeSection('alertTimeline', { isEmpty: false }),
      new FakeSection('occupancyOverTime', { isEmpty: true }),
    ];

    const { isEmpty } = await new ReportBuilder({ sections }).build(kelaniContext(), {
      sectionKeys: ['occupancyOverTime'],
      generatedBy: 'u',
    });

    expect(isEmpty).toBe(true);
  });

  it('DMS-160.1: the real sections over no data at all make an empty report', async () => {
    const nothing = async () => [];
    const sections = [
      new AlertTimelineSection({ alerts: { findForReport: nothing } }),
      new CitizensReachedSection({
        alerts: { findForReport: nothing },
        deliveries: { findSent: nothing },
      }),
      new OccupancyOverTimeSection({
        names: fakeNames(),
        occupancy: { findLatestBefore: nothing, findInRange: nothing },
      }),
      new ResourceDistributionSection({
        names: fakeNames(),
        distributions: { findInRange: nothing },
      }),
    ];

    const { isEmpty, report } = await build(sections);

    expect(isEmpty).toBe(true);
    expect(report.sections).toHaveLength(4);
  });
});

describe('ReportSection.summarise', () => {
  it('DMS-153.5: a section gives no summary figures unless it defines them', () => {
    class Quiet extends ReportSection {}
    expect(new Quiet().summarise({ anything: 1 })).toEqual({});
  });

  it('TC-16 Main 11: peak occupancy is the highest daily total, the earlier day on a tie, ignoring gap days', () => {
    const section = new OccupancyOverTimeSection({ occupancy: {}, names: fakeNames() });
    const days = (peaks) => peaks.map(([date, peak]) => ({ date, peak }));

    expect(
      section.summarise({
        districts: [
          {
            days: days([
              ['2026-06-11', 300],
              ['2026-06-12', 100],
              ['2026-06-14', null],
            ]),
          },
          {
            days: days([
              ['2026-06-11', 100],
              ['2026-06-12', 300],
              ['2026-06-14', null],
            ]),
          },
        ],
      }),
    ).toEqual({ peakOccupancy: 400, peakOccupancyDate: '2026-06-11' });
  });

  it('DMS-153.5: peak occupancy is null when every day is a gap', () => {
    const section = new OccupancyOverTimeSection({ occupancy: {}, names: fakeNames() });

    expect(
      section.summarise({ districts: [{ days: [{ date: '2026-06-14', peak: null }] }] }),
    ).toEqual({
      peakOccupancy: null,
      peakOccupancyDate: null,
    });
  });
});
