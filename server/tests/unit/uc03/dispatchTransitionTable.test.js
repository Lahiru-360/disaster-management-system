import { Dispatch } from '../../../src/domain/coordination/Dispatch.js';
import { InvalidDispatchTransitionError } from '../../../src/domain/coordination/InvalidDispatchTransitionError.js';
import { DispatchStatus } from '../../../src/enums/DispatchStatus.js';
import { TeamStatus } from '../../../src/enums/TeamStatus.js';

// DMS-152.1: the whole Dispatch state machine as one table - every status
// against every move, the legal pairs with where they lead and what happens to
// the team, and all the others refused. The expectations are written out from
// the UC03 design (class diagram, E3 and E4), not read back from the class.
const DEADLINE = new Date('2026-10-03T09:35:00.000Z');
const AFTER_DEADLINE = new Date(DEADLINE.getTime() + 1);
const BY = 'user-1';

// Each move, how to make it on a dispatch, and what a refusal says it was.
const MOVES = {
  assign: { run: (d) => d.assign('team-2', DEADLINE, BY, AFTER_DEADLINE), verb: 'assigned a team' },
  acknowledge: { run: (d) => d.acknowledge(BY, AFTER_DEADLINE), verb: 'acknowledged' },
  decline: { run: (d) => d.decline('Vehicle unavailable', BY, AFTER_DEADLINE), verb: 'declined' },
  markOnSite: { run: (d) => d.markOnSite(BY, AFTER_DEADLINE), verb: 'marked on site' },
  complete: { run: (d) => d.complete(BY, AFTER_DEADLINE), verb: 'completed' },
  // Only an overdue dispatch can be marked, so the time passed is past the deadline.
  markUnresponsive: {
    run: (d) => d.markUnresponsive(AFTER_DEADLINE),
    verb: 'marked unresponsive',
  },
};

// The only legal pairs: [status, move, status after, team's new status].
const LEGAL = [
  [DispatchStatus.UNASSIGNED, 'assign', DispatchStatus.ASSIGNED, TeamStatus.DISPATCHED],
  [DispatchStatus.ASSIGNED, 'acknowledge', DispatchStatus.ACKNOWLEDGED, null],
  [DispatchStatus.ASSIGNED, 'decline', DispatchStatus.DECLINED, TeamStatus.AVAILABLE],
  [
    DispatchStatus.ASSIGNED,
    'markUnresponsive',
    DispatchStatus.UNRESPONSIVE,
    TeamStatus.UNAVAILABLE,
  ],
  [DispatchStatus.ACKNOWLEDGED, 'markOnSite', DispatchStatus.ON_SITE, TeamStatus.ON_SITE],
  [DispatchStatus.ON_SITE, 'complete', DispatchStatus.COMPLETED, TeamStatus.AVAILABLE],
];

const ILLEGAL = Object.values(DispatchStatus).flatMap((status) =>
  Object.keys(MOVES)
    .filter((move) => !LEGAL.some(([from, legalMove]) => from === status && legalMove === move))
    .map((move) => [status, move]),
);

const build = (status) =>
  new Dispatch({
    dispatchId: '66fb0c1b2c3d4e5f6a7b8e01',
    status,
    team: status === DispatchStatus.UNASSIGNED ? null : 'team-1',
    ackDeadline: status === DispatchStatus.ASSIGNED ? DEADLINE : null,
  });

describe('Dispatch transition table', () => {
  it('Domain: has 7 statuses and 6 moves, so 42 pairs of which 6 are legal', () => {
    expect(Object.values(DispatchStatus)).toHaveLength(7);
    expect(Object.keys(MOVES)).toHaveLength(6);
    expect(LEGAL).toHaveLength(6);
    expect(ILLEGAL).toHaveLength(36);
  });

  it.each(LEGAL)('Domain: %s + %s leads to %s (team -> %p)', (from, move, to, teamStatus) => {
    const built = build(from);

    expect(MOVES[move].run(built)).toEqual({ teamStatus });
    expect(built.status).toBe(to);
    expect(built.can(move)).toBe(false);
    expect(built.statusHistory).toHaveLength(1);
    expect(built.statusHistory[0]).toMatchObject({ status: to, at: AFTER_DEADLINE });
  });

  it.each(ILLEGAL)('TC-24: %s + %s is refused with 409 and changes nothing', (from, move) => {
    const built = build(from);

    let error;
    try {
      MOVES[move].run(built);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(InvalidDispatchTransitionError);
    expect(error).toMatchObject({
      status: 409,
      code: 'INVALID_DISPATCH_TRANSITION',
      message: `This dispatch is ${from} and can't be ${MOVES[move].verb}.`,
      currentStatus: from,
    });
    expect(built.status).toBe(from);
    expect(built.statusHistory).toEqual([]);
    expect(built.can(move)).toBe(false);
  });

  it.each(LEGAL)('Domain: can(%s -> %s) is true before the move and only there', (from, move) => {
    expect(build(from).can(move)).toBe(true);
    for (const status of Object.values(DispatchStatus).filter((s) => s !== from)) {
      expect(build(status).can(move)).toBe(LEGAL.some(([f, m]) => f === status && m === move));
    }
  });

  it('Domain: COMPLETED, DECLINED and UNRESPONSIVE are final - nothing can move them', () => {
    for (const status of [
      DispatchStatus.COMPLETED,
      DispatchStatus.DECLINED,
      DispatchStatus.UNRESPONSIVE,
    ]) {
      for (const move of Object.keys(MOVES)) {
        expect(build(status).can(move)).toBe(false);
      }
    }
  });

  it('Domain: the happy path runs UNASSIGNED to COMPLETED in 4 recorded moves', () => {
    const built = build(DispatchStatus.UNASSIGNED);

    built.assign('team-1', DEADLINE, BY, AFTER_DEADLINE);
    built.acknowledge(BY, AFTER_DEADLINE);
    built.markOnSite(BY, AFTER_DEADLINE);
    built.complete(BY, AFTER_DEADLINE);

    expect(built.statusHistory.map((entry) => entry.status)).toEqual([
      DispatchStatus.ASSIGNED,
      DispatchStatus.ACKNOWLEDGED,
      DispatchStatus.ON_SITE,
      DispatchStatus.COMPLETED,
    ]);
  });
});
