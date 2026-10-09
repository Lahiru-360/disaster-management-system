import mongoose from 'mongoose';
import { Dispatch } from '../../../src/domain/coordination/Dispatch.js';
import { InvalidDispatchTransitionError } from '../../../src/domain/coordination/InvalidDispatchTransitionError.js';
import { DispatchStatus } from '../../../src/enums/DispatchStatus.js';
import { TeamStatus } from '../../../src/enums/TeamStatus.js';
import { Dispatch as DispatchModel } from '../../../src/models/Dispatch.js';

const ID = '66fb0c1b2c3d4e5f6a7b8e01';
const LEAD = new mongoose.Types.ObjectId();
const AT = new Date('2026-10-03T09:32:10.000Z');

const dispatch = (status, fields = {}) => new Dispatch({ dispatchId: ID, status, ...fields });

// Every move, the status it starts from, where it leads and the team's new status.
const LEGAL = [
  ['acknowledge', DispatchStatus.ASSIGNED, DispatchStatus.ACKNOWLEDGED, null],
  ['markOnSite', DispatchStatus.ACKNOWLEDGED, DispatchStatus.ON_SITE, TeamStatus.ON_SITE],
  ['complete', DispatchStatus.ON_SITE, DispatchStatus.COMPLETED, TeamStatus.AVAILABLE],
];

const VERBS = { acknowledge: 'acknowledged', markOnSite: 'marked on site', complete: 'completed' };

describe('Dispatch state machine', () => {
  it.each(LEGAL)('Main 10-11: %s moves %s to %s (team -> %s)', (action, from, to, team) => {
    const built = dispatch(from);

    expect(built[action](LEAD, AT)).toEqual({ teamStatus: team });
    expect(built.status).toBe(to);
    expect(built.statusHistory).toEqual([{ status: to, at: AT, by: LEAD }]);
  });

  // Every move from every status the table doesn't allow it from.
  const ILLEGAL = LEGAL.flatMap(([action, from]) =>
    Object.values(DispatchStatus)
      .filter((status) => status !== from)
      .map((status) => [action, status]),
  );

  it.each(ILLEGAL)('TC-24: %s from %s is refused with 409 and changes nothing', (action, from) => {
    const built = dispatch(from);

    let error;
    try {
      built[action](LEAD, AT);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(InvalidDispatchTransitionError);
    expect(error).toMatchObject({
      status: 409,
      code: 'INVALID_DISPATCH_TRANSITION',
      message: `This dispatch is ${from} and can't be ${VERBS[action]}.`,
      currentStatus: from,
    });
    expect(built.status).toBe(from);
    expect(built.statusHistory).toEqual([]);
  });

  it('TC-22: Main 11 the full path ASSIGNED -> ACKNOWLEDGED -> ON_SITE -> COMPLETED', () => {
    const built = dispatch(DispatchStatus.ASSIGNED, {
      statusHistory: [
        { status: DispatchStatus.ASSIGNED, at: new Date('2026-10-03T09:30:00Z'), by: null },
      ],
    });

    built.acknowledge(LEAD, AT);
    built.markOnSite(LEAD, AT);
    built.complete(LEAD, AT);

    expect(built.status).toBe(DispatchStatus.COMPLETED);
    expect(built.statusHistory.map((entry) => entry.status)).toEqual([
      DispatchStatus.ASSIGNED,
      DispatchStatus.ACKNOWLEDGED,
      DispatchStatus.ON_SITE,
      DispatchStatus.COMPLETED,
    ]);
  });

  it('Main 10: a move with no actor records by: null', () => {
    const built = dispatch(DispatchStatus.ASSIGNED);

    built.acknowledge(undefined, AT);

    expect(built.statusHistory[0].by).toBeNull();
  });

  it('Domain: can() reports what the table allows', () => {
    expect(dispatch(DispatchStatus.ASSIGNED).can('acknowledge')).toBe(true);
    expect(dispatch(DispatchStatus.ASSIGNED).can('complete')).toBe(false);
    expect(dispatch(DispatchStatus.COMPLETED).can('acknowledge')).toBe(false);
  });

  it('Domain: the history getter hands out a copy', () => {
    const built = dispatch(DispatchStatus.ASSIGNED);
    built.statusHistory.push({ status: 'X' });

    expect(built.statusHistory).toEqual([]);
  });
});

describe('Dispatch E3 assign', () => {
  const DEADLINE = new Date('2026-10-03T09:37:10.000Z');

  const queued = () =>
    dispatch(DispatchStatus.UNASSIGNED, {
      ackDeadline: null,
      supportRequested: true,
      statusHistory: [
        { status: DispatchStatus.UNASSIGNED, at: new Date('2026-10-03T09:30:00Z'), by: LEAD },
      ],
    });

  it('TC-52: E3 assign moves UNASSIGNED to ASSIGNED, takes the team and the new deadline', () => {
    const built = queued();

    expect(built.assign('team-1', DEADLINE, LEAD, AT)).toEqual({
      teamStatus: TeamStatus.DISPATCHED,
    });
    expect(built.status).toBe(DispatchStatus.ASSIGNED);
    expect(built.team).toBe('team-1');
    expect(built.ackDeadline).toEqual(DEADLINE);
    expect(built.statusHistory.map((entry) => entry.status)).toEqual([
      DispatchStatus.UNASSIGNED,
      DispatchStatus.ASSIGNED,
    ]);
    expect(built.statusHistory[1]).toEqual({ status: DispatchStatus.ASSIGNED, at: AT, by: LEAD });
  });

  it('E3: a queued dispatch has no team or deadline, and remembers the support request', () => {
    const built = queued();

    expect(built.team).toBeNull();
    expect(built.ackDeadline).toBeNull();
    expect(built.supportRequested).toBe(true);
    expect(dispatch(DispatchStatus.UNASSIGNED).supportRequested).toBe(false);
  });

  it('E3: an unassigned dispatch can only be assigned', () => {
    const built = queued();

    expect(built.can('assign')).toBe(true);
    for (const action of ['acknowledge', 'decline', 'markOnSite', 'complete']) {
      expect(built.can(action)).toBe(false);
    }
  });

  it.each(Object.values(DispatchStatus).filter((s) => s !== DispatchStatus.UNASSIGNED))(
    'TC-24: E3 assign from %s is refused with 409 and changes nothing',
    (from) => {
      const built = dispatch(from, { team: 'team-1' });

      expect(() => built.assign('team-2', DEADLINE, LEAD, AT)).toThrow(
        new InvalidDispatchTransitionError(from, 'assigned a team'),
      );
      expect(built.status).toBe(from);
      expect(built.team).toBe('team-1');
      expect(built.ackDeadline).toBeNull();
      expect(built.statusHistory).toEqual([]);
    },
  );

  it.each([
    ['a team', [null, DEADLINE]],
    ['a deadline', ['team-1', null]],
  ])('E3: assign needs %s and changes nothing without it', (_name, [team, deadline]) => {
    const built = queued();

    expect(() => built.assign(team, deadline, LEAD, AT)).toThrow(/needs a/);
    expect(built.status).toBe(DispatchStatus.UNASSIGNED);
    expect(built.team).toBeNull();
  });

  it('E3: an assigned dispatch carries on to COMPLETED like any other', () => {
    const built = queued();

    built.assign('team-1', DEADLINE, LEAD, AT);
    built.acknowledge(LEAD, AT);
    built.markOnSite(LEAD, AT);
    built.complete(LEAD, AT);

    expect(built.status).toBe(DispatchStatus.COMPLETED);
  });
});

describe('Dispatch construction', () => {
  it('Domain: keeps its details', () => {
    const built = dispatch(DispatchStatus.ASSIGNED, {
      team: 'team-1',
      createdAt: '2026-10-03T09:30:00.000Z',
      ackDeadline: '2026-10-03T09:35:00.000Z',
    });

    expect(built.dispatchId).toBe(ID);
    expect(built.team).toBe('team-1');
    expect(built.createdAt).toEqual(new Date('2026-10-03T09:30:00.000Z'));
    expect(built.ackDeadline).toEqual(new Date('2026-10-03T09:35:00.000Z'));
  });

  it('Domain: defaults to no team, no deadline and no history', () => {
    const built = dispatch(DispatchStatus.ASSIGNED);

    expect(built.team).toBeNull();
    expect(built.createdAt).toBeUndefined();
    expect(built.ackDeadline).toBeNull();
    expect(built.statusHistory).toEqual([]);
  });

  it('Domain: needs a dispatchId and a known status', () => {
    expect(() => new Dispatch()).toThrow('Dispatch needs a dispatchId');
    expect(() => dispatch('LOST')).toThrow('Unknown dispatch status: LOST');
  });

  it.each([
    ['hydrated', (doc) => doc],
    ['toJSON', (doc) => doc.toJSON()],
  ])('Domain: maps a %s Dispatch document', (_form, as) => {
    const doc = new DispatchModel({
      team: new mongoose.Types.ObjectId(),
      status: DispatchStatus.ASSIGNED,
      createdAt: new Date('2026-10-03T09:30:00.000Z'),
      ackDeadline: new Date('2026-10-03T09:35:00.000Z'),
      statusHistory: [
        { status: DispatchStatus.ASSIGNED, at: new Date('2026-10-03T09:30:00.000Z') },
      ],
    });

    const built = Dispatch.fromDocument(as(doc));

    expect(built.dispatchId).toBe(String(doc._id));
    expect(built.status).toBe(DispatchStatus.ASSIGNED);
    expect(built.statusHistory).toHaveLength(1);
    expect(built.acknowledge(LEAD, AT)).toEqual({ teamStatus: null });
  });
});
