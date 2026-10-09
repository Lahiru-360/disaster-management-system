import { jest } from '@jest/globals';
import { OccupancyOverTimeSection } from '../../../src/services/reports/sections/OccupancyOverTimeSection.js';
import { D, at, fakeNames, kelaniContext, onDay } from './reportFixtures.js';

const occupancy = (shelter, district, occupants, recordedAt) => ({
  shelter,
  district,
  occupants,
  recordedAt,
});

const sectionWith = ({ before = [], inRange = [] } = {}) => {
  const repository = {
    findLatestBefore: jest.fn(async () => before),
    findInRange: jest.fn(async () => inRange),
  };
  return {
    section: new OccupancyOverTimeSection({ occupancy: repository, names: fakeNames() }),
    repository,
  };
};

const districtOf = (result, id) => result.districts.find((row) => row.district.id === id);

describe('OccupancyOverTimeSection', () => {
  it('DMS-153.3: is the occupancyOverTime section, with "No occupancy records" gaps', () => {
    const { section } = sectionWith();
    expect([section.key, section.gapReason]).toEqual(['occupancyOverTime', 'No occupancy records']);
  });

  it("DMS-153.3: reads the selected districts' records in the range and the latest before it", async () => {
    const ctx = kelaniContext({ districtIds: [D.gampaha] });
    const { section, repository } = sectionWith();
    const { start, end } = ctx.instants();

    await section.compile(ctx);

    expect(repository.findInRange).toHaveBeenCalledWith({ districtIds: [D.gampaha], start, end });
    expect(repository.findLatestBefore).toHaveBeenCalledWith({ districtIds: [D.gampaha], start });
  });

  it('TC-10 Main 8: the daily peak is the highest value of the day, not the last one', async () => {
    const { section } = sectionWith({
      inRange: [
        occupancy('s1', D.gampaha, 300, at(12, '08:00')),
        occupancy('s1', D.gampaha, 520, at(12, '14:00')),
        occupancy('s1', D.gampaha, 410, at(12, '20:00')),
      ],
    });

    const { result } = await section.compile(kelaniContext({ districtIds: [D.gampaha] }));

    expect(onDay(districtOf(result, D.gampaha).days, '2026-06-12', 'peak')).toBe(520);
  });

  it('TC-11 Main 8: several shelters in a district are summed at each record time before taking the peak', async () => {
    // s1 and s2 are in Gampaha. Their sums over the day: 200, 200+150=350,
    // 50+150=200, 50+400=450. The peak is 450, although no shelter held 450.
    const { section } = sectionWith({
      inRange: [
        occupancy('s1', D.gampaha, 200, at(12, '06:00')),
        occupancy('s2', D.gampaha, 150, at(12, '09:00')),
        occupancy('s1', D.gampaha, 50, at(12, '12:00')),
        occupancy('s2', D.gampaha, 400, at(12, '18:00')),
      ],
    });

    const { result } = await section.compile(kelaniContext({ districtIds: [D.gampaha] }));

    expect(onDay(districtOf(result, D.gampaha).days, '2026-06-12', 'peak')).toBe(450);
  });

  it('TC-11 Main 8: updates saved at the same moment are applied together before summing', async () => {
    // At 09:00 s1 empties to 50 as s2 fills to 300: the district holds 350,
    // never 500 + 300.
    const { section } = sectionWith({
      inRange: [
        occupancy('s1', D.gampaha, 500, at(12, '06:00')),
        occupancy('s2', D.gampaha, 300, at(12, '09:00')),
        occupancy('s1', D.gampaha, 50, at(12, '09:00')),
      ],
    });

    const { result } = await section.compile(kelaniContext({ districtIds: [D.gampaha] }));

    expect(onDay(districtOf(result, D.gampaha).days, '2026-06-12', 'peak')).toBe(500);
    expect(districtOf(result, D.gampaha).peak).toEqual({ value: 500, date: '2026-06-12' });
  });

  it('DMS-153.3: a shelter that last reported before the range still counts with its last value', async () => {
    const { section } = sectionWith({
      before: [occupancy('s1', D.gampaha, 600, at(7, '18:00'))],
      inRange: [occupancy('s2', D.gampaha, 100, at(9, '10:00'))],
    });

    const { result } = await section.compile(kelaniContext({ districtIds: [D.gampaha] }));

    expect(onDay(districtOf(result, D.gampaha).days, '2026-06-09', 'peak')).toBe(700);
  });

  it('DMS-153.3: a day without records in a district is null, not carried over or 0', async () => {
    const { section } = sectionWith({
      inRange: [occupancy('s1', D.gampaha, 300, at(12)), occupancy('s9', D.colombo, 90, at(13))],
    });

    const { result } = await section.compile(kelaniContext());

    const gampaha = districtOf(result, D.gampaha);
    expect(onDay(gampaha.days, '2026-06-12', 'peak')).toBe(300);
    expect(onDay(gampaha.days, '2026-06-13', 'peak')).toBeNull();
    expect(gampaha.days).toHaveLength(13);
  });

  it('DMS-153.3: lists every selected district in order, named, with its peak day', async () => {
    const { section } = sectionWith({
      inRange: [
        occupancy('s1', D.gampaha, 300, at(12)),
        occupancy('s1', D.gampaha, 300, at(16)),
        occupancy('s9', D.colombo, 90, at(13)),
      ],
    });

    const { result } = await section.compile(kelaniContext());

    expect(result.districts.map((row) => [row.district, row.peak])).toEqual([
      [
        { id: D.colombo, name: 'Colombo' },
        { value: 90, date: '2026-06-13' },
      ],
      // A tie goes to the earlier day.
      [
        { id: D.gampaha, name: 'Gampaha' },
        { value: 300, date: '2026-06-12' },
      ],
      [{ id: D.kalutara, name: 'Kalutara' }, null],
    ]);
  });

  it('TC-13 Main 10: no records in any district on 14-15 Jun is one gap, 14-15 Jun', async () => {
    const inRange = [8, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20].map((day) =>
      occupancy('s1', day % 2 === 0 ? D.gampaha : D.colombo, 100 + day, at(day)),
    );
    const { section } = sectionWith({ inRange });

    const { gaps, isEmpty } = await section.compile(kelaniContext());

    expect(isEmpty).toBe(false);
    expect(gaps.map((gap) => gap.toJSON())).toEqual([
      {
        section: 'occupancyOverTime',
        from: '2026-06-14',
        to: '2026-06-15',
        reason: 'No occupancy records',
      },
    ]);
  });

  it('DMS-153.3: ignores records of a district that was not selected', async () => {
    const { section } = sectionWith({
      before: [occupancy('s7', D.kalutara, 999, at(7))],
      inRange: [occupancy('s7', D.kalutara, 999, at(12))],
    });

    const { result, isEmpty } = await section.compile(kelaniContext({ districtIds: [D.gampaha] }));

    expect(result.districts.map((row) => row.district.id)).toEqual([D.gampaha]);
    expect(isEmpty).toBe(true);
  });

  it('DMS-153.3: records only from before the range leave the section empty', async () => {
    const { section } = sectionWith({ before: [occupancy('s1', D.gampaha, 600, at(7))] });

    const { result, isEmpty, gaps } = await section.compile(kelaniContext());

    expect(isEmpty).toBe(true);
    expect(result.districts.every((row) => row.peak === null)).toBe(true);
    expect(gaps.map((gap) => [gap.from, gap.to])).toEqual([['2026-06-08', '2026-06-20']]);
  });
});
