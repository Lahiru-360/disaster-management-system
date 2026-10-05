import { HazardEvent } from '../../src/domain/events/HazardEvent.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { SriLankaCalendar } from '../../src/utils/SriLankaCalendar.js';

// The Kelani basin floods as seeded: 8-20 Jun 2026, dates stored as midnight UTC.
const kelani = () =>
  new HazardEvent({
    eventId: 'e1',
    name: 'Kelani basin floods',
    hazardType: 'FLOOD',
    status: EventStatus.CLOSED,
    startDate: '2026-06-08T00:00:00.000Z',
    endDate: '2026-06-20T00:00:00.000Z',
    districts: ['d1', 'd2', 'd3'],
  });

const gampahaFlood = () =>
  new HazardEvent({
    eventId: 'e2',
    status: EventStatus.ACTIVE,
    startDate: '2026-09-25T00:00:00.000Z',
  });

describe('SriLankaCalendar.dayOf', () => {
  it.each([
    ['2026-06-07T18:29:59.999Z', '2026-06-07'],
    ['2026-06-07T18:30:00.000Z', '2026-06-08'],
    ['2026-06-08T00:00:00.000Z', '2026-06-08'],
    ['2026-06-20T18:29:59.999Z', '2026-06-20'],
  ])('DMS-107: puts %s on Sri Lanka day %s (UTC+5:30)', (instant, day) => {
    expect(SriLankaCalendar.dayOf(instant)).toBe(day);
  });

  it.each([null, undefined, 'not a date'])('DMS-107: has no day for %p', (value) => {
    expect(SriLankaCalendar.dayOf(value)).toBeNull();
  });
});

describe('HazardEvent (domain)', () => {
  it('DMS-107: a CLOSED event is closed and an ACTIVE one is not', () => {
    expect(kelani().isClosed()).toBe(true);
    expect(gampahaFlood().isClosed()).toBe(false);
  });

  it.each([
    ['the first minute of the start day', '2026-06-07T18:30:00.000Z', true],
    ['the start instant', '2026-06-08T00:00:00.000Z', true],
    ['the afternoon of the end day', '2026-06-20T09:30:00.000Z', true],
    ['the last minute of the end day', '2026-06-20T18:29:59.999Z', true],
    ['the day before it starts', '2026-06-07T18:29:59.999Z', false],
    ['the day after it ends', '2026-06-20T18:30:00.000Z', false],
    ['a date months later', '2026-09-01T00:00:00.000Z', false],
  ])('DMS-107: a closed event covers %s: %p', (_when, date, covered) => {
    expect(kelani().covers(date)).toBe(covered);
  });

  it('DMS-107: an ACTIVE event covers every day from its start, and none before', () => {
    const event = gampahaFlood();

    expect(event.covers('2026-09-25T00:00:00.000Z')).toBe(true);
    expect(event.covers('2030-01-01T00:00:00.000Z')).toBe(true);
    expect(event.covers('2026-09-24T12:00:00.000Z')).toBe(false);
  });

  it('DMS-107: covers no missing or invalid date', () => {
    expect(kelani().covers(null)).toBe(false);
    expect(kelani().covers('not a date')).toBe(false);
  });

  it('DMS-107: maps a document, keeping its id as a string and endDate null while ACTIVE', () => {
    const event = HazardEvent.fromDocument({
      _id: { toString: () => '66f7c1a2b3c4d5e6f7a8b9c1' },
      name: 'Flood – Gampaha District',
      hazardType: 'FLOOD',
      status: EventStatus.ACTIVE,
      startDate: new Date('2026-09-25T00:00:00.000Z'),
      endDate: null,
      districts: ['d2'],
    });

    expect(event.eventId).toBe('66f7c1a2b3c4d5e6f7a8b9c1');
    expect(event.name).toBe('Flood – Gampaha District');
    expect(event.hazardType).toBe('FLOOD');
    expect(event.status).toBe(EventStatus.ACTIVE);
    expect(event.startDate).toEqual(new Date('2026-09-25T00:00:00.000Z'));
    expect(event.endDate).toBeNull();
    expect(event.districts).toEqual(['d2']);
    expect(Object.isFrozen(event.districts)).toBe(true);
  });

  it('DMS-107: maps a toJSON form by its id', () => {
    expect(HazardEvent.fromDocument({ id: 'e9', startDate: '2026-06-08' }).eventId).toBe('e9');
  });

  it('DMS-107: needs an eventId', () => {
    expect(() => new HazardEvent({ startDate: '2026-06-08' })).toThrow(
      'HazardEvent needs an eventId',
    );
  });
});
