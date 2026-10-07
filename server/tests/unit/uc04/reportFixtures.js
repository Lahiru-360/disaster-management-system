import { ReportContext } from '../../../src/domain/analysis/ReportContext.js';
import { HazardEvent } from '../../../src/domain/events/HazardEvent.js';
import { EventStatus } from '../../../src/enums/EventStatus.js';

// Small fixed datasets for the UC04 section unit tests: the Kelani basin
// floods, 8-20 Jun 2026, over three districts. Ids are plain strings, since a
// section only compares them.
export const D = Object.freeze({ colombo: 'd-col', gampaha: 'd-gam', kalutara: 'd-kal' });

export const DISTRICT_NAMES = Object.freeze({
  [D.colombo]: 'Colombo',
  [D.gampaha]: 'Gampaha',
  [D.kalutara]: 'Kalutara',
});

export const kelaniEvent = new HazardEvent({
  eventId: 'e-kelani',
  name: 'Kelani basin floods',
  hazardType: 'FLOOD',
  status: EventStatus.CLOSED,
  startDate: '2026-06-08T00:00:00.000Z',
  endDate: '2026-06-20T00:00:00.000Z',
  districts: [D.colombo, D.gampaha, D.kalutara],
});

/** A context over the whole event and all three districts, unless overridden. */
export const kelaniContext = (fields = {}) =>
  new ReportContext({
    event: kelaniEvent,
    dateFrom: '2026-06-08',
    dateTo: '2026-06-20',
    districtIds: [D.colombo, D.gampaha, D.kalutara],
    ...fields,
  });

/** An instant at a Sri Lanka local time on a June 2026 day, e.g. at(14, '09:00'). */
export const at = (day, time = '12:00') =>
  new Date(`2026-06-${String(day).padStart(2, '0')}T${time}:00.000+05:30`);

/** A ReportNames stand-in that names districts from DISTRICT_NAMES and organisations from `organisations`. */
export const fakeNames = (organisations = {}) => ({
  districts: async (ids) =>
    new Map(ids.map((id) => [id, { id, name: DISTRICT_NAMES[id] ?? null }])),
  organisations: async (ids) =>
    new Map(
      ids.map((id) => [
        id,
        { id, name: organisations[id]?.name ?? null, type: organisations[id]?.type ?? null },
      ]),
    ),
});

/** The value a daily series holds for one day. */
export const onDay = (days, date, field) => days.find((entry) => entry.date === date)[field];
