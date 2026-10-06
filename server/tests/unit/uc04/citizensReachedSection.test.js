import { jest } from '@jest/globals';
import { CitizensReachedSection } from '../../../src/services/reports/sections/CitizensReachedSection.js';
import { at, kelaniContext, onDay } from './reportFixtures.js';

const alert = (id, referenceNo, firstAt) => ({
  id,
  referenceNo,
  hazardType: 'FLOOD',
  severity: 'HIGH',
  areas: [],
  history: [{ status: 'BROADCAST', version: 1, at: firstAt, severity: null, areas: null }],
});

// HA-1004 was issued before HA-1003, so it comes first in the timeline.
const ha1003 = alert('a-1003', 'HA-1003', at(9, '08:00'));
const ha1004 = alert('a-1004', 'HA-1004', at(8, '08:00'));

const record = (alertId, citizen, channel, status, sentAt = at(9)) => ({
  alert: alertId,
  citizen,
  channel,
  status,
  sentAt,
});

// Four citizens targeted:
// - c1 is DELIVERED on PUSH and SMS: reached once (TC-07)
// - c2 is DELIVERED on SMS by both alerts: reached once
// - c3 only FAILED: not reached (TC-08)
// - c4 only SENT (not confirmed): targeted, not reached
const RECORDS = [
  record('a-1003', 'c1', 'PUSH', 'DELIVERED'),
  record('a-1003', 'c1', 'SMS', 'DELIVERED'),
  record('a-1003', 'c2', 'SMS', 'DELIVERED'),
  record('a-1004', 'c2', 'SMS', 'DELIVERED', at(8)),
  record('a-1003', 'c3', 'PUSH', 'FAILED'),
  record('a-1003', 'c3', 'SMS', 'FAILED'),
  record('a-1003', 'c4', 'AUDIBLE', 'SENT'),
];

const sectionWith = (alerts, records) => {
  const alertRepository = { findForReport: jest.fn(async () => alerts) };
  const deliveries = { findSent: jest.fn(async () => records) };
  return {
    section: new CitizensReachedSection({ alerts: alertRepository, deliveries }),
    alertRepository,
    deliveries,
  };
};

describe('CitizensReachedSection', () => {
  it('DMS-153.3: is the citizensReached section, with "No delivery records" gaps', () => {
    const { section } = sectionWith([], []);
    expect([section.key, section.gapReason]).toEqual(['citizensReached', 'No delivery records']);
  });

  it("DMS-153.3: reads the deliveries of the report's alerts inside the range", async () => {
    const ctx = kelaniContext();
    const { section, alertRepository, deliveries } = sectionWith([ha1003, ha1004], RECORDS);

    await section.compile(ctx);

    expect(alertRepository.findForReport).toHaveBeenCalledWith(ctx);
    expect(deliveries.findSent).toHaveBeenCalledWith({
      alertIds: ['a-1004', 'a-1003'],
      ...ctx.instants(),
    });
  });

  it('TC-06 Main 7: counts the distinct citizens with at least one DELIVERED record', async () => {
    const { section } = sectionWith([ha1003, ha1004], RECORDS);

    const { result, isEmpty } = await section.compile(kelaniContext());

    expect(isEmpty).toBe(false);
    expect(result.citizensReached).toBe(2);
    expect(result.citizensTargeted).toBe(4);
    expect(result.reachedRate).toBe(0.5);
  });

  it('TC-07 Main 7: a citizen DELIVERED on SMS and push counts once', async () => {
    const { section } = sectionWith(
      [ha1003],
      [record('a-1003', 'c1', 'PUSH', 'DELIVERED'), record('a-1003', 'c1', 'SMS', 'DELIVERED')],
    );

    const { result } = await section.compile(kelaniContext());

    expect(result.citizensReached).toBe(1);
  });

  it('TC-08 Main 7: a citizen with only FAILED records is not counted as reached', async () => {
    const { section } = sectionWith(
      [ha1003],
      [record('a-1003', 'c3', 'PUSH', 'FAILED'), record('a-1003', 'c3', 'SMS', 'FAILED')],
    );

    const { result } = await section.compile(kelaniContext());

    expect(result.citizensReached).toBe(0);
    expect(result.citizensTargeted).toBe(1);
    expect(result.reachedRate).toBe(0);
  });

  it('TC-09 Main 7: gives each channel its delivery rate, delivered / attempted, exactly', async () => {
    const { section } = sectionWith([ha1003, ha1004], RECORDS);

    const { result } = await section.compile(kelaniContext());

    expect(result.perChannel).toEqual([
      { channel: 'PUSH', attempted: 2, delivered: 1, failed: 1, deliveryRate: 0.5 },
      { channel: 'SMS', attempted: 4, delivered: 3, failed: 1, deliveryRate: 0.75 },
      { channel: 'AUDIBLE', attempted: 1, delivered: 0, failed: 0, deliveryRate: 0 },
    ]);
  });

  it('DMS-153.3: breaks the counts down per alert, in timeline order', async () => {
    const { section } = sectionWith([ha1003, ha1004], RECORDS);

    const { result } = await section.compile(kelaniContext());

    expect(result.perAlert).toEqual([
      {
        alert: { id: 'a-1004', referenceNo: 'HA-1004' },
        citizensReached: 1,
        perChannel: [
          { channel: 'PUSH', attempted: 0, delivered: 0 },
          { channel: 'SMS', attempted: 1, delivered: 1 },
          { channel: 'AUDIBLE', attempted: 0, delivered: 0 },
        ],
      },
      {
        alert: { id: 'a-1003', referenceNo: 'HA-1003' },
        citizensReached: 2,
        perChannel: [
          { channel: 'PUSH', attempted: 2, delivered: 1 },
          { channel: 'SMS', attempted: 3, delivered: 2 },
          { channel: 'AUDIBLE', attempted: 1, delivered: 0 },
        ],
      },
    ]);
  });

  it('DMS-153.3: orders alerts by their first change inside the range, then reference number', async () => {
    const early = {
      ...alert('a-1001', 'HA-1001', at(1)),
      history: [
        { status: 'BROADCAST', version: 1, at: at(1), severity: null, areas: null },
        { status: 'UPDATED', version: 2, at: at(9, '08:00'), severity: null, areas: null },
      ],
    };
    const { section } = sectionWith([early, ha1003, ha1004], []);

    const { result } = await section.compile(kelaniContext());

    expect(result.perAlert.map((row) => row.alert.referenceNo)).toEqual([
      'HA-1004',
      'HA-1001',
      'HA-1003',
    ]);
  });

  it('DMS-153.3: counts the records per day of their sentAt, with null on days without any', async () => {
    const { section } = sectionWith([ha1003, ha1004], RECORDS);

    const { result, gaps } = await section.compile(
      kelaniContext({ dateFrom: '2026-06-08', dateTo: '2026-06-10' }),
    );

    expect(result.days).toEqual([
      { date: '2026-06-08', attempted: 1, delivered: 1 },
      { date: '2026-06-09', attempted: 6, delivered: 3 },
      { date: '2026-06-10', attempted: null, delivered: null },
    ]);
    expect(onDay(result.days, '2026-06-10', 'attempted')).toBeNull();
    expect(gaps.map((gap) => gap.toJSON())).toEqual([
      {
        section: 'citizensReached',
        from: '2026-06-10',
        to: '2026-06-10',
        reason: 'No delivery records',
      },
    ]);
  });

  it('DMS-153.3: with no deliveries the section is empty, and the rates are null', async () => {
    const { section } = sectionWith([ha1003], []);

    const { result, isEmpty, gaps } = await section.compile(kelaniContext());

    expect(isEmpty).toBe(true);
    expect(result.citizensReached).toBe(0);
    expect(result.reachedRate).toBeNull();
    expect(result.perChannel.map((row) => row.deliveryRate)).toEqual([null, null, null]);
    expect(gaps).toHaveLength(1);
  });

  it('DMS-153.3: with no alerts it asks for no deliveries', async () => {
    const { section, deliveries } = sectionWith([], []);

    const { result } = await section.compile(kelaniContext());

    expect(deliveries.findSent).toHaveBeenCalledWith(expect.objectContaining({ alertIds: [] }));
    expect(result.perAlert).toEqual([]);
  });
});
