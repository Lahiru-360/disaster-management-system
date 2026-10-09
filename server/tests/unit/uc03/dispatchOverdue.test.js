import { Dispatch } from '../../../src/domain/coordination/Dispatch.js';
import { InvalidDispatchTransitionError } from '../../../src/domain/coordination/InvalidDispatchTransitionError.js';
import { DispatchStatus } from '../../../src/enums/DispatchStatus.js';
import { TeamStatus } from '../../../src/enums/TeamStatus.js';

// UC03 E4 (DMS-150.1): a dispatch the lead never answered.
const DEADLINE = new Date('2026-10-03T09:35:00.000Z');
const at = (offsetMs) => new Date(DEADLINE.getTime() + offsetMs);

const dispatch = (status = DispatchStatus.ASSIGNED, ackDeadline = DEADLINE) =>
  new Dispatch({ dispatchId: '66fb0c1b2c3d4e5f6a7b8e01', status, ackDeadline });

describe('Dispatch.isOverdue', () => {
  it('is not overdue before the deadline', () => {
    expect(dispatch().isOverdue(at(-60 * 1000))).toBe(false);
  });

  it('TC-54: E4 is not overdue at exactly the deadline', () => {
    expect(dispatch().isOverdue(at(0))).toBe(false);
  });

  it('TC-55: E4 is overdue one millisecond after the deadline', () => {
    expect(dispatch().isOverdue(at(1))).toBe(true);
  });

  it.each([
    DispatchStatus.ACKNOWLEDGED,
    DispatchStatus.ON_SITE,
    DispatchStatus.COMPLETED,
    DispatchStatus.DECLINED,
    DispatchStatus.UNRESPONSIVE,
  ])(
    'TC-58: a %s dispatch is never overdue, however late, so is never marked unresponsive',
    (status) => {
      expect(dispatch(status).isOverdue(at(60 * 60 * 1000))).toBe(false);
    },
  );

  it('is not overdue without a deadline', () => {
    expect(dispatch(DispatchStatus.ASSIGNED, null).isOverdue(at(60 * 60 * 1000))).toBe(false);
  });

  it('accepts a date or a timestamp for now', () => {
    expect(dispatch().isOverdue(at(1).toISOString())).toBe(true);
    expect(dispatch().isOverdue(at(1).getTime())).toBe(true);
  });
});

describe('Dispatch.markUnresponsive', () => {
  it('TC-56: E4.1 ASSIGNED -> UNRESPONSIVE once overdue, and the team UNAVAILABLE', () => {
    const built = dispatch();

    expect(built.markUnresponsive(at(1000))).toEqual({ teamStatus: TeamStatus.UNAVAILABLE });
    expect(built.status).toBe(DispatchStatus.UNRESPONSIVE);
  });

  it('TC-56: records it in the history with no author, since the system does it', () => {
    const built = dispatch();

    built.markUnresponsive(at(1000));

    expect(built.statusHistory).toEqual([
      { status: DispatchStatus.UNRESPONSIVE, at: at(1000), by: null },
    ]);
  });

  it('refuses before the deadline, and at exactly the deadline, changing nothing', () => {
    const built = dispatch();

    expect(() => built.markUnresponsive(at(0))).toThrow(
      'A dispatch can only be marked unresponsive after its deadline',
    );
    expect(built.status).toBe(DispatchStatus.ASSIGNED);
    expect(built.statusHistory).toEqual([]);
  });

  it.each([
    DispatchStatus.ACKNOWLEDGED,
    DispatchStatus.ON_SITE,
    DispatchStatus.COMPLETED,
    DispatchStatus.DECLINED,
    DispatchStatus.UNRESPONSIVE,
  ])('from %s it is refused and changes nothing', (from) => {
    const built = dispatch(from);

    expect(() => built.markUnresponsive(at(1000))).toThrow(
      new InvalidDispatchTransitionError(from, 'marked unresponsive'),
    );
    expect(built.status).toBe(from);
  });

  it('TC-57: an UNRESPONSIVE dispatch can no longer be acknowledged, declined or completed', () => {
    const built = dispatch();
    built.markUnresponsive(at(1000));

    expect(() => built.acknowledge(null, at(2000))).toThrow(
      new InvalidDispatchTransitionError(DispatchStatus.UNRESPONSIVE, 'acknowledged'),
    );
    expect(() => built.decline('Too late', null, at(2000))).toThrow(
      new InvalidDispatchTransitionError(DispatchStatus.UNRESPONSIVE, 'declined'),
    );
    expect(() => built.complete(null, at(2000))).toThrow(
      new InvalidDispatchTransitionError(DispatchStatus.UNRESPONSIVE, 'completed'),
    );
  });

  it('can() offers markUnresponsive only while ASSIGNED', () => {
    expect(dispatch().can('markUnresponsive')).toBe(true);
    expect(dispatch(DispatchStatus.ACKNOWLEDGED).can('markUnresponsive')).toBe(false);
  });
});
