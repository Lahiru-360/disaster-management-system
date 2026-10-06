import { jest } from '@jest/globals';
import { AlertTimelineSection } from '../../../src/services/reports/sections/AlertTimelineSection.js';
import { at, kelaniContext, onDay } from './reportFixtures.js';

const KELANI_BASIN = { kind: 'RiverBasin', id: 'b-kel', name: 'Kelani' };
const KALUTARA = { kind: 'District', id: 'd-kal', name: 'Kalutara' };

// HA-1003: issued on 8 Jun, raised to SEVERE on 10 Jun, all-clear on 19 Jun.
const ha1003 = {
  id: 'a-1003',
  referenceNo: 'HA-1003',
  hazardType: 'FLOOD',
  severity: 'SEVERE',
  areas: [KELANI_BASIN],
  history: [
    { status: 'BROADCAST', version: 1, at: at(8, '08:40'), severity: null, areas: null },
    { status: 'UPDATED', version: 2, at: at(10, '17:15'), severity: null, areas: null },
    { status: 'CANCELLED', version: 2, at: at(19, '09:00'), severity: null, areas: null },
  ],
};

// HA-1004: issued on 8 Jun at the same minute as HA-1003's issue.
const ha1004 = {
  id: 'a-1004',
  referenceNo: 'HA-1004',
  hazardType: 'FLOOD',
  severity: 'HIGH',
  areas: [KALUTARA],
  history: [{ status: 'BROADCAST', version: 1, at: at(8, '08:40'), severity: null, areas: null }],
};

const sectionWith = (alerts) => {
  const repository = { findForReport: jest.fn(async () => alerts) };
  return { section: new AlertTimelineSection({ alerts: repository }), repository };
};

describe('AlertTimelineSection', () => {
  it('DMS-153.3: is the alertTimeline section, with "No alert records" gaps', () => {
    const { section } = sectionWith([]);
    expect([section.key, section.gapReason]).toEqual(['alertTimeline', 'No alert records']);
  });

  it('TC-04 Main 6: lists the issue, each update and the all-clear in time order, with versions', async () => {
    const ctx = kelaniContext();
    const { section, repository } = sectionWith([ha1004, ha1003]);

    const { result, isEmpty } = await section.compile(ctx);

    expect(repository.findForReport).toHaveBeenCalledWith(ctx);
    expect(isEmpty).toBe(false);
    expect(
      result.entries.map((entry) => [
        entry.date,
        entry.alert.referenceNo,
        entry.status,
        entry.version,
      ]),
    ).toEqual([
      ['2026-06-08', 'HA-1003', 'BROADCAST', 1],
      ['2026-06-08', 'HA-1004', 'BROADCAST', 1],
      ['2026-06-10', 'HA-1003', 'UPDATED', 2],
      ['2026-06-19', 'HA-1003', 'CANCELLED', 2],
    ]);
    expect(result.alerts).toBe(2);
  });

  it('TC-04 Main 6: each entry carries its time, hazard type, severity and areas', async () => {
    const { section } = sectionWith([ha1003]);

    const { result } = await section.compile(kelaniContext());

    expect(result.entries[0]).toEqual({
      at: '2026-06-08T03:10:00.000Z',
      date: '2026-06-08',
      alert: { id: 'a-1003', referenceNo: 'HA-1003' },
      status: 'BROADCAST',
      version: 1,
      hazardType: 'FLOOD',
      severity: 'SEVERE',
      areas: [KELANI_BASIN],
    });
  });

  it('DMS-153.3: uses the severity and areas recorded at a change when the history has them', async () => {
    const recorded = {
      ...ha1003,
      history: [
        { status: 'BROADCAST', version: 1, at: at(8), severity: 'HIGH', areas: [KELANI_BASIN] },
        {
          status: 'UPDATED',
          version: 2,
          at: at(10),
          severity: 'SEVERE',
          areas: [KELANI_BASIN, KALUTARA],
        },
      ],
    };
    const { section } = sectionWith([recorded]);

    const { result } = await section.compile(kelaniContext());

    expect(result.entries.map((entry) => [entry.severity, entry.areas.length])).toEqual([
      ['HIGH', 1],
      ['SEVERE', 2],
    ]);
  });

  it('TC-05 Main 6: leaves out the changes that fall outside a narrowed range', async () => {
    const { section } = sectionWith([ha1003, ha1004]);

    const { result } = await section.compile(
      kelaniContext({ dateFrom: '2026-06-09', dateTo: '2026-06-18' }),
    );

    expect(result.entries.map((entry) => [entry.alert.referenceNo, entry.status])).toEqual([
      ['HA-1003', 'UPDATED'],
    ]);
    expect(result.alerts).toBe(1);
  });

  it('DMS-153.3: counts the entries per day, and gives null on days without any', async () => {
    const { section } = sectionWith([ha1003, ha1004]);

    const { result } = await section.compile(kelaniContext());

    expect(result.days).toHaveLength(13);
    expect(onDay(result.days, '2026-06-08', 'entries')).toBe(2);
    expect(onDay(result.days, '2026-06-10', 'entries')).toBe(1);
    expect(onDay(result.days, '2026-06-09', 'entries')).toBeNull();
  });

  it('DMS-153.3: marks the days without alert records as gaps', async () => {
    const { section } = sectionWith([ha1003]);

    const { gaps } = await section.compile(
      kelaniContext({ dateFrom: '2026-06-08', dateTo: '2026-06-11' }),
    );

    expect(gaps.map((gap) => gap.toJSON())).toEqual([
      {
        section: 'alertTimeline',
        from: '2026-06-09',
        to: '2026-06-09',
        reason: 'No alert records',
      },
      {
        section: 'alertTimeline',
        from: '2026-06-11',
        to: '2026-06-11',
        reason: 'No alert records',
      },
    ]);
  });

  it('DMS-153.3: no alerts is an empty section, one gap over the whole range', async () => {
    const { section } = sectionWith([]);

    const { result, isEmpty, gaps } = await section.compile(kelaniContext());

    expect(isEmpty).toBe(true);
    expect(result.alerts).toBe(0);
    expect(result.entries).toEqual([]);
    expect(gaps.map((gap) => [gap.from, gap.to])).toEqual([['2026-06-08', '2026-06-20']]);
  });
});
