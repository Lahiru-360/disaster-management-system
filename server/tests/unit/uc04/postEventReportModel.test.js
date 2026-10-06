import mongoose from 'mongoose';
import { ReportSectionKey } from '../../../src/enums/ReportSectionKey.js';
import { PostEventReport } from '../../../src/models/PostEventReport.js';

const eventId = new mongoose.Types.ObjectId();
const officerId = new mongoose.Types.ObjectId();
const districtId = new mongoose.Types.ObjectId();

const reportFields = (fields = {}) => ({
  event: eventId,
  generatedBy: officerId,
  generatedAt: new Date('2026-10-06T09:00:00.000Z'),
  dateFrom: '2026-06-08',
  dateTo: '2026-06-20',
  districts: [districtId],
  sections: [{ key: ReportSectionKey.OCCUPANCY_OVER_TIME, result: { districts: [] } }],
  ...fields,
});

// The messages Mongoose collected, by path, or {} when the document is valid.
const errorsOf = async (doc) => {
  try {
    await doc.validate();
    return {};
  } catch (err) {
    return Object.fromEntries(Object.entries(err.errors).map(([path, e]) => [path, e.message]));
  }
};

beforeAll(async () => {
  await PostEventReport.init();
});

describe('ReportSectionKey', () => {
  it('DMS-153: has the four UC04 sections in report order, and is frozen', () => {
    expect(Object.values(ReportSectionKey)).toEqual([
      'alertTimeline',
      'citizensReached',
      'occupancyOverTime',
      'resourceDistribution',
    ]);
    expect(Object.isFrozen(ReportSectionKey)).toBe(true);
  });
});

describe('PostEventReport model', () => {
  it('DMS-153: stores a report with empty filters, a null summary and no gaps by default', async () => {
    const saved = await PostEventReport.create(reportFields());

    expect(saved.filters.toObject()).toEqual({
      hazardType: null,
      districtId: null,
      organisationId: null,
    });
    expect(saved.summary.toObject()).toEqual({
      alertsIssued: null,
      citizensReached: null,
      citizensTargeted: null,
      reachedRate: null,
      peakOccupancy: null,
      peakOccupancyDate: null,
      itemsDistributed: null,
    });
    expect(saved.gaps).toHaveLength(0);
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeUndefined();
  });

  it('DMS-153: stores data gaps and each section result as given', async () => {
    const result = {
      districts: [{ district: String(districtId), days: [{ date: '2026-06-14', peak: null }] }],
    };
    const saved = await PostEventReport.create(
      reportFields({
        sections: [{ key: ReportSectionKey.OCCUPANCY_OVER_TIME, result }],
        gaps: [
          {
            section: ReportSectionKey.OCCUPANCY_OVER_TIME,
            from: '2026-06-14',
            to: '2026-06-15',
            reason: 'No occupancy records',
          },
        ],
      }),
    );

    const found = await PostEventReport.findById(saved._id).lean();
    expect(found.sections).toEqual([{ key: 'occupancyOverTime', result }]);
    expect(found.gaps).toEqual([
      {
        section: 'occupancyOverTime',
        from: '2026-06-14',
        to: '2026-06-15',
        reason: 'No occupancy records',
      },
    ]);
  });

  it('DMS-153: requires its event, officer, generation time, range and districts', async () => {
    const errors = await errorsOf(
      new PostEventReport(
        reportFields({
          event: undefined,
          generatedBy: undefined,
          generatedAt: undefined,
          dateFrom: undefined,
          dateTo: undefined,
          districts: [],
        }),
      ),
    );

    expect(Object.keys(errors).sort()).toEqual([
      'dateFrom',
      'dateTo',
      'districts',
      'event',
      'generatedAt',
      'generatedBy',
    ]);
  });

  it.each(['2026-6-8', '2026-02-30', '08/06/2026', '2026-06-08T00:00:00.000Z'])(
    'DMS-153: refuses %p as a report day',
    async (value) => {
      const errors = await errorsOf(new PostEventReport(reportFields({ dateFrom: value })));
      expect(errors.dateFrom).toBe('must be a calendar day as YYYY-MM-DD');
    },
  );

  it('DMS-153: refuses a range that starts after it ends, and accepts a one-day range', async () => {
    expect(
      await errorsOf(
        new PostEventReport(reportFields({ dateFrom: '2026-06-21', dateTo: '2026-06-20' })),
      ),
    ).toEqual({ dateFrom: 'must not be after dateTo' });
    expect(
      await errorsOf(
        new PostEventReport(reportFields({ dateFrom: '2026-06-14', dateTo: '2026-06-14' })),
      ),
    ).toEqual({});
  });

  it('DMS-153: needs at least one section, never the same one twice, and only known keys', async () => {
    const section = { key: ReportSectionKey.ALERT_TIMELINE, result: { entries: [] } };

    expect((await errorsOf(new PostEventReport(reportFields({ sections: [] })))).sections).toBe(
      'must hold at least one section',
    );
    expect(
      (await errorsOf(new PostEventReport(reportFields({ sections: [section, section] }))))
        .sections,
    ).toBe('must not repeat a section');
    expect(
      Object.keys(
        await errorsOf(
          new PostEventReport(reportFields({ sections: [{ key: 'weather', result: {} }] })),
        ),
      ),
    ).toContain('sections.0.key');
  });

  it('DMS-153: refuses an incomplete gap, or one that ends before it starts', async () => {
    const gap = (fields) => ({
      section: ReportSectionKey.RESOURCE_DISTRIBUTION,
      from: '2026-06-14',
      to: '2026-06-15',
      reason: 'No distribution records',
      ...fields,
    });

    const errors = await errorsOf(
      new PostEventReport(
        reportFields({
          gaps: [
            gap({ section: 'weather' }),
            gap({ to: '2026-06-13' }),
            gap({ reason: undefined, from: 'soon' }),
          ],
        }),
      ),
    );

    expect(errors).toEqual({
      'gaps.0.section': expect.any(String),
      'gaps.1.to': 'must not be before from',
      'gaps.2.from': 'must be a calendar day as YYYY-MM-DD',
      'gaps.2.reason': expect.any(String),
    });
  });

  it('DMS-153: refuses summary figures below zero and a rate above one', async () => {
    const errors = await errorsOf(
      new PostEventReport(
        reportFields({
          summary: { alertsIssued: -1, reachedRate: 1.2, peakOccupancyDate: 'June' },
        }),
      ),
    );

    expect(Object.keys(errors).sort()).toEqual([
      'summary.alertsIssued',
      'summary.peakOccupancyDate',
      'summary.reachedRate',
    ]);
  });

  it('DMS-156: refuses a filter hazard type outside the alert hazard types', async () => {
    const errors = await errorsOf(
      new PostEventReport(reportFields({ filters: { hazardType: 'TSUNAMI' } })),
    );
    expect(Object.keys(errors)).toEqual(['filters.hazardType']);
  });

  it('DMS-153: toJSON exposes id and drops _id and __v', async () => {
    const json = (await PostEventReport.create(reportFields())).toJSON();

    expect(json.id).toBeDefined();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
