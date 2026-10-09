import { DataGap } from '../../../src/domain/analysis/DataGap.js';
import { ReportSectionKey } from '../../../src/enums/ReportSectionKey.js';
import { ReportSection } from '../../../src/services/reports/ReportSection.js';
import { kelaniContext } from './reportFixtures.js';

class Incomplete extends ReportSection {}

class Occupancy extends ReportSection {
  get key() {
    return ReportSectionKey.OCCUPANCY_OVER_TIME;
  }

  get gapReason() {
    return 'No occupancy records';
  }
}

describe('ReportSection (abstract strategy)', () => {
  it('DMS-153.3: cannot be created itself, only through a section', () => {
    expect(() => new ReportSection()).toThrow(/abstract/);
    expect(new Occupancy()).toBeInstanceOf(ReportSection);
  });

  it('DMS-153.3: a section that leaves out key, gapReason or compile says which', async () => {
    const section = new Incomplete();

    expect(() => section.key).toThrow('Incomplete must define key');
    expect(() => section.gapReason).toThrow('Incomplete must define gapReason');
    await expect(section.compile(kelaniContext())).rejects.toThrow(
      'Incomplete must implement compile(ctx)',
    );
  });

  it("DMS-153.3: findGaps turns the days without records into DataGaps with the section's reason", () => {
    const ctx = kelaniContext({ dateFrom: '2026-06-13', dateTo: '2026-06-16' });

    const gaps = new Occupancy().findGaps(ctx, ['2026-06-13', '2026-06-16']);

    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toBeInstanceOf(DataGap);
    expect(gaps[0].toJSON()).toEqual({
      section: 'occupancyOverTime',
      from: '2026-06-14',
      to: '2026-06-15',
      reason: 'No occupancy records',
    });
  });
});
