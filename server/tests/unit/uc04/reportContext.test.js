import { ReportContext } from '../../../src/domain/analysis/ReportContext.js';
import { HazardEvent } from '../../../src/domain/events/HazardEvent.js';
import { EventStatus } from '../../../src/enums/EventStatus.js';
import { SriLankaCalendar } from '../../../src/utils/SriLankaCalendar.js';
import { systemClock } from '../../../src/utils/SystemClock.js';
import { FakeClock } from '../../helpers/FakeClock.js';

const kelani = new HazardEvent({
  eventId: 'e1',
  name: 'Kelani basin floods',
  hazardType: 'FLOOD',
  status: EventStatus.CLOSED,
  startDate: '2026-06-08T00:00:00.000Z',
  endDate: '2026-06-20T00:00:00.000Z',
  districts: ['d1', 'd2', 'd3'],
});

const context = (fields = {}) =>
  new ReportContext({
    event: kelani,
    dateFrom: '2026-06-08',
    dateTo: '2026-06-20',
    districtIds: ['d1', 'd2', 'd3'],
    ...fields,
  });

describe('SriLankaCalendar day helpers', () => {
  it('DMS-153.4: a day starts at its Sri Lanka midnight, 18:30 UTC the day before', () => {
    expect(SriLankaCalendar.startOf('2026-06-08')).toEqual(new Date('2026-06-07T18:30:00.000Z'));
  });

  it('DMS-153.4: daysBetween lists both ends and every day between, across a month end', () => {
    expect(SriLankaCalendar.daysBetween('2026-06-29', '2026-07-02')).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
    ]);
    expect(SriLankaCalendar.daysBetween('2026-06-14', '2026-06-14')).toEqual(['2026-06-14']);
    expect(SriLankaCalendar.daysBetween('2026-06-15', '2026-06-14')).toEqual([]);
  });

  it('DMS-153.4: the day helpers refuse anything but a YYYY-MM-DD day', () => {
    expect(() => SriLankaCalendar.startOf('14 Jun')).toThrow(/YYYY-MM-DD/);
    expect(() => SriLankaCalendar.daysBetween('2026-06-14', null)).toThrow(/YYYY-MM-DD/);
  });
});

describe('ReportContext', () => {
  it('DMS-153.4: holds the event, range, districts, empty filters and the system clock', () => {
    const ctx = context();

    expect(ctx.event).toBe(kelani);
    expect([ctx.dateFrom, ctx.dateTo]).toEqual(['2026-06-08', '2026-06-20']);
    expect(ctx.districtIds).toEqual(['d1', 'd2', 'd3']);
    expect(ctx.filters).toEqual({ hazardType: null, districtId: null, organisationId: null });
    expect(ctx.clock).toBe(systemClock);
  });

  it('DMS-153.4: keeps an injected clock and the filters it is given, ids as strings', () => {
    const clock = new FakeClock('2026-10-06T09:00:00.000Z');
    const districtId = { toString: () => 'd2' };
    const ctx = context({ clock, filters: { hazardType: 'FLOOD', districtId, organisationId: 7 } });

    expect(ctx.clock).toBe(clock);
    expect(ctx.filters).toEqual({ hazardType: 'FLOOD', districtId: 'd2', organisationId: '7' });
  });

  it('DMS-153.4: the selection cannot be changed by a section', () => {
    const ctx = context();

    expect(() => ctx.districtIds.push('d4')).toThrow(TypeError);
    expect(() => {
      ctx.filters.districtId = 'd4';
    }).toThrow(TypeError);
  });

  it('DMS-153.4: days() lists every day of the inclusive range', () => {
    const days = context().days();

    expect(days).toHaveLength(13);
    expect([days[0], days[6], days[12]]).toEqual(['2026-06-08', '2026-06-14', '2026-06-20']);
    expect(context({ dateFrom: '2026-06-14', dateTo: '2026-06-14' }).days()).toEqual([
      '2026-06-14',
    ]);
  });

  it('DMS-153.4: instants() runs from the first Sri Lanka midnight to the one after the last day', () => {
    expect(context().instants()).toEqual({
      start: new Date('2026-06-07T18:30:00.000Z'),
      end: new Date('2026-06-20T18:30:00.000Z'),
    });
  });

  it.each([
    ['2026-06-07T18:29:59.999Z', null],
    ['2026-06-07T18:30:00.000Z', '2026-06-08'],
    ['2026-06-14T20:00:00.000Z', '2026-06-15'],
    ['2026-06-20T18:29:59.999Z', '2026-06-20'],
    ['2026-06-20T18:30:00.000Z', null],
    ['not a date', null],
  ])('DMS-153.4: dayOf(%s) is %p', (instant, day) => {
    expect(context().dayOf(instant)).toBe(day);
  });

  it('DMS-153.4: includesDistrict matches the selected districts by id', () => {
    const ctx = context({ districtIds: ['d1', 'd3'] });

    expect(ctx.includesDistrict('d3')).toBe(true);
    expect(ctx.includesDistrict({ toString: () => 'd1' })).toBe(true);
    expect(ctx.includesDistrict('d2')).toBe(false);
    expect(ctx.includesDistrict(null)).toBe(false);
  });

  it.each([
    ['no event', { event: undefined }, /event/],
    ['a day that is not YYYY-MM-DD', { dateTo: '20 Jun' }, /YYYY-MM-DD/],
    ['a range that starts after it ends', { dateFrom: '2026-06-21' }, /not be after/],
    ['no districts', { districtIds: [] }, /at least one district/],
  ])('DMS-153.4: refuses %s', (_label, fields, message) => {
    expect(() => context(fields)).toThrow(message);
  });

  it('DMS-153.4: refuses no arguments at all', () => {
    expect(() => new ReportContext()).toThrow(/event/);
  });
});
