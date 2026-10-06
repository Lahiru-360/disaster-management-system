import { GapDetector } from '../../../src/domain/analysis/GapDetector.js';
import { SriLankaCalendar } from '../../../src/utils/SriLankaCalendar.js';

// The Kelani basin floods: 8-20 Jun 2026.
const KELANI = SriLankaCalendar.daysBetween('2026-06-08', '2026-06-20');
const allBut = (...missing) => KELANI.filter((day) => !missing.includes(day));

describe('GapDetector.findGaps', () => {
  it('TC-13 Main 10: a two-day hole in the middle is one gap, 14-15 Jun', () => {
    expect(GapDetector.findGaps(KELANI, allBut('2026-06-14', '2026-06-15'))).toEqual([
      { from: '2026-06-14', to: '2026-06-15' },
    ]);
  });

  it('TC-14 Main 10: finds a gap on the first day and on the last day of the range', () => {
    expect(GapDetector.findGaps(KELANI, allBut('2026-06-08', '2026-06-20'))).toEqual([
      { from: '2026-06-08', to: '2026-06-08' },
      { from: '2026-06-20', to: '2026-06-20' },
    ]);
  });

  it('TC-14 Main 10: a gap running into the range end stops at the last day', () => {
    expect(GapDetector.findGaps(KELANI, allBut('2026-06-18', '2026-06-19', '2026-06-20'))).toEqual([
      { from: '2026-06-18', to: '2026-06-20' },
    ]);
  });

  it('TC-15 Main 10: non-consecutive missing days are separate gaps', () => {
    expect(GapDetector.findGaps(KELANI, allBut('2026-06-10', '2026-06-12', '2026-06-13'))).toEqual([
      { from: '2026-06-10', to: '2026-06-10' },
      { from: '2026-06-12', to: '2026-06-13' },
    ]);
  });

  it('DMS-153.4: a range with records every day has no gaps', () => {
    expect(GapDetector.findGaps(KELANI, KELANI)).toEqual([]);
  });

  it('DMS-153.4: a range with no records at all is one gap over the whole range', () => {
    expect(GapDetector.findGaps(KELANI, [])).toEqual([{ from: '2026-06-08', to: '2026-06-20' }]);
  });

  it('DMS-153.4: ignores record days outside the range, and repeated record days', () => {
    const recordDays = [
      '2026-06-07',
      '2026-06-21',
      ...allBut('2026-06-14'),
      '2026-06-09',
      '2026-06-09',
    ];
    expect(GapDetector.findGaps(KELANI, recordDays)).toEqual([
      { from: '2026-06-14', to: '2026-06-14' },
    ]);
  });

  it('DMS-153.4: takes record days from any iterable, such as a Set', () => {
    expect(GapDetector.findGaps(['2026-06-14', '2026-06-15'], new Set(['2026-06-15']))).toEqual([
      { from: '2026-06-14', to: '2026-06-14' },
    ]);
  });

  it('DMS-153.4: a one-day range is either one gap or none', () => {
    expect(GapDetector.findGaps(['2026-06-14'], [])).toEqual([
      { from: '2026-06-14', to: '2026-06-14' },
    ]);
    expect(GapDetector.findGaps(['2026-06-14'], ['2026-06-14'])).toEqual([]);
  });

  it('DMS-153.4: an empty range has no gaps', () => {
    expect(GapDetector.findGaps([], ['2026-06-14'])).toEqual([]);
  });
});
