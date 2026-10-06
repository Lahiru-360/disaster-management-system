import { ReportParameters } from '../../../src/domain/analysis/ReportParameters.js';
import { D, kelaniEvent } from './reportFixtures.js';

// The Kelani basin floods: 8-20 Jun 2026 over Colombo, Gampaha and Kalutara.
const params = (fields = {}) => ({
  from: '2026-06-08',
  to: '2026-06-20',
  districtIds: [D.colombo, D.gampaha, D.kalutara],
  ...fields,
});

const check = (fields) => ReportParameters.problemsWith(kelaniEvent, params(fields));

describe('ReportParameters.problemsWith (E1)', () => {
  it('DMS-159.1: the event defaults have no problems', () => {
    expect(check()).toEqual([]);
  });

  it('DMS-159.1: a narrowed range and one district have no problems', () => {
    expect(check({ from: '2026-06-12', to: '2026-06-15', districtIds: [D.gampaha] })).toEqual([]);
  });

  it('DMS-159.1: a single day, from = to, is a valid range, on the first and the last day', () => {
    expect(check({ from: '2026-06-08', to: '2026-06-08' })).toEqual([]);
    expect(check({ from: '2026-06-20', to: '2026-06-20' })).toEqual([]);
  });

  it('DMS-159.1: a start after the end is a problem on from', () => {
    expect(check({ from: '2026-06-15', to: '2026-06-12' })).toEqual([
      { field: 'from', message: 'must not be after to' },
    ]);
  });

  it('DMS-159.1: a start before the event began is a problem on from, naming the start date', () => {
    expect(check({ from: '2026-06-07' })).toEqual([
      { field: 'from', message: 'must be on or after the event start date 2026-06-08' },
    ]);
  });

  it('DMS-159.1: an end after the event ended is a problem on to, naming the end date', () => {
    expect(check({ to: '2026-06-21' })).toEqual([
      { field: 'to', message: 'must be on or before the event end date 2026-06-20' },
    ]);
  });

  it('DMS-159.1: a district the event did not affect is a problem on districtIds', () => {
    expect(check({ districtIds: [D.colombo, 'd-kandy'] })).toEqual([
      { field: 'districtIds', message: 'must be a district the event affected' },
    ]);
  });

  it('DMS-159.1: reports every field with a problem, once each', () => {
    expect(
      check({ from: '2026-06-25', to: '2026-06-22', districtIds: ['d-kandy', 'd-galle'] }),
    ).toEqual([
      { field: 'from', message: 'must not be after to' },
      { field: 'to', message: 'must be on or before the event end date 2026-06-20' },
      { field: 'districtIds', message: 'must be a district the event affected' },
    ]);
  });

  it('DMS-159.1: compares in Sri Lanka days, so an event stored at midnight UTC keeps its dates', () => {
    // 2026-06-08T00:00Z is 05:30 on 8 Jun in Sri Lanka: still 8 Jun.
    expect(check({ from: '2026-06-08', to: '2026-06-20' })).toEqual([]);
  });
});
