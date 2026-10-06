import mongoose from 'mongoose';
import { DataGap } from '../../../src/domain/analysis/DataGap.js';
import { PostEventReport } from '../../../src/domain/analysis/PostEventReport.js';
import { ReportSectionKey } from '../../../src/enums/ReportSectionKey.js';
import { PostEventReport as PostEventReportModel } from '../../../src/models/PostEventReport.js';
import { SriLankaCalendar } from '../../../src/utils/SriLankaCalendar.js';

const { OCCUPANCY_OVER_TIME, RESOURCE_DISTRIBUTION } = ReportSectionKey;

const occupancyGap = (fields = {}) => ({
  section: OCCUPANCY_OVER_TIME,
  from: '2026-06-14',
  to: '2026-06-15',
  reason: 'No occupancy records',
  ...fields,
});

const report = (fields = {}) =>
  new PostEventReport({
    eventId: 'e1',
    generatedBy: 'u1',
    generatedAt: '2026-10-06T09:00:00.000Z',
    dateFrom: '2026-06-08',
    dateTo: '2026-06-20',
    districts: ['d1', 'd2', 'd3'],
    ...fields,
  });

describe('SriLankaCalendar.isDay', () => {
  it.each(['2026-06-08', '2028-02-29'])('DMS-153: accepts %p', (value) => {
    expect(SriLankaCalendar.isDay(value)).toBe(true);
  });

  it.each(['2026-6-8', '2026-02-30', '2027-02-29', '2026-06-08T00:00:00.000Z', '', null, 20260608])(
    'DMS-153: refuses %p',
    (value) => {
      expect(SriLankaCalendar.isDay(value)).toBe(false);
    },
  );
});

describe('DataGap (domain)', () => {
  it('DMS-153: holds a section, an inclusive range and a trimmed reason', () => {
    const gap = new DataGap(occupancyGap({ reason: '  No occupancy records ' }));

    expect(gap.toJSON()).toEqual({
      section: 'occupancyOverTime',
      from: '2026-06-14',
      to: '2026-06-15',
      reason: 'No occupancy records',
    });
    expect([gap.section, gap.from, gap.to, gap.reason]).toEqual([
      'occupancyOverTime',
      '2026-06-14',
      '2026-06-15',
      'No occupancy records',
    ]);
  });

  it('DMS-153: a single day is a gap from and to the same day', () => {
    expect(new DataGap(occupancyGap({ from: '2026-06-08', to: '2026-06-08' })).to).toBe(
      '2026-06-08',
    );
  });

  it.each([
    ['an unknown section', { section: 'weather' }, /report section/],
    ['a day that is not YYYY-MM-DD', { from: '14 Jun' }, /YYYY-MM-DD/],
    ['a range that ends before it starts', { from: '2026-06-16' }, /not be after/],
    ['an empty reason', { reason: '   ' }, /reason/],
  ])('DMS-153: refuses %s', (_label, fields, message) => {
    expect(() => new DataGap(occupancyGap(fields))).toThrow(message);
  });

  it('DMS-153: refuses no arguments at all', () => {
    expect(() => new DataGap()).toThrow(/report section/);
  });
});

describe('PostEventReport (domain)', () => {
  it('DMS-153: a new report has no id, sections or gaps yet', () => {
    const fresh = report();

    expect(fresh.reportId).toBeNull();
    expect(fresh.eventId).toBe('e1');
    expect(fresh.generatedBy).toBe('u1');
    expect(fresh.generatedAt).toEqual(new Date('2026-10-06T09:00:00.000Z'));
    expect([fresh.dateFrom, fresh.dateTo]).toEqual(['2026-06-08', '2026-06-20']);
    expect(fresh.districts).toEqual(['d1', 'd2', 'd3']);
    expect(fresh.sections).toEqual([]);
    expect(fresh.gaps).toEqual([]);
    expect(fresh.hasGaps()).toBe(false);
  });

  it('DMS-153: needs the event it is about', () => {
    expect(() => new PostEventReport()).toThrow(/eventId/);
  });

  it('DMS-153: addSection keeps sections in the order added, with their gaps', () => {
    const built = report()
      .addSection({ key: OCCUPANCY_OVER_TIME, result: { districts: [] }, gaps: [occupancyGap()] })
      .addSection({ key: RESOURCE_DISTRIBUTION, result: { rows: [], total: 0 } });

    expect(built.sections.map((section) => section.key)).toEqual([
      OCCUPANCY_OVER_TIME,
      RESOURCE_DISTRIBUTION,
    ]);
    expect(built.gaps.map((gap) => gap.toJSON())).toEqual([occupancyGap()]);
    expect(built.hasGaps()).toBe(true);
  });

  it('DMS-153: a report whose sections found no gaps has none', () => {
    const built = report().addSection({
      key: RESOURCE_DISTRIBUTION,
      result: { rows: [] },
      gaps: [],
    });
    expect(built.hasGaps()).toBe(false);
  });

  it('DMS-153: accepts gaps already built as DataGap objects', () => {
    const gap = new DataGap(occupancyGap());
    const built = report().addSection({ key: OCCUPANCY_OVER_TIME, result: {}, gaps: [gap] });
    expect(built.gaps).toEqual([gap]);
  });

  it.each([
    ['an unknown section', { key: 'weather', result: {} }, /Unknown report section/],
    ['a section without a result', { key: OCCUPANCY_OVER_TIME, result: null }, /no result/],
    [
      "another section's gap",
      { key: RESOURCE_DISTRIBUTION, result: {}, gaps: [occupancyGap()] },
      /belongs to another section/,
    ],
  ])('DMS-153: addSection refuses %s', (_label, section, message) => {
    expect(() => report().addSection(section)).toThrow(message);
  });

  it('DMS-153: addSection refuses the same section twice', () => {
    const built = report().addSection({ key: OCCUPANCY_OVER_TIME, result: {} });
    expect(() => built.addSection({ key: OCCUPANCY_OVER_TIME, result: {} })).toThrow(/added twice/);
  });

  it('DMS-153: the sections and gaps it hands out cannot change the report', () => {
    const built = report().addSection({
      key: OCCUPANCY_OVER_TIME,
      result: {},
      gaps: [occupancyGap()],
    });

    expect(() => built.sections.push({ key: RESOURCE_DISTRIBUTION, result: {} })).toThrow(
      TypeError,
    );
    expect(() => built.gaps.pop()).toThrow(TypeError);
    expect(built.sections).toHaveLength(1);
    expect(built.gaps).toHaveLength(1);
  });

  it('DMS-153: fromDocument maps a stored report, with its sections and gaps', async () => {
    const eventId = new mongoose.Types.ObjectId();
    const doc = await PostEventReportModel.create({
      event: eventId,
      generatedBy: new mongoose.Types.ObjectId(),
      generatedAt: new Date('2026-10-06T09:00:00.000Z'),
      dateFrom: '2026-06-08',
      dateTo: '2026-06-20',
      districts: [new mongoose.Types.ObjectId()],
      sections: [{ key: OCCUPANCY_OVER_TIME, result: { districts: [] } }],
      gaps: [occupancyGap()],
    });

    const mapped = PostEventReport.fromDocument(doc);

    expect(mapped.reportId).toBe(String(doc._id));
    expect(mapped.eventId).toBe(String(eventId));
    expect(mapped.sections).toEqual([{ key: OCCUPANCY_OVER_TIME, result: { districts: [] } }]);
    expect(mapped.gaps.map((gap) => gap.toJSON())).toEqual([occupancyGap()]);
    expect(mapped.hasGaps()).toBe(true);
  });

  it('DMS-153: fromDocument reads the id of a populated event', () => {
    const mapped = PostEventReport.fromDocument({
      id: 'r1',
      event: { id: 'e9', name: 'Kelani basin floods' },
      generatedAt: '2026-10-06T09:00:00.000Z',
      dateFrom: '2026-06-08',
      dateTo: '2026-06-20',
    });

    expect(mapped.reportId).toBe('r1');
    expect(mapped.eventId).toBe('e9');
  });
});
