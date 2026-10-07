import { DispatchStatus } from '../../enums/DispatchStatus.js';
import { TeamStatus } from '../../enums/TeamStatus.js';
import { InvalidDispatchTransitionError } from './InvalidDispatchTransitionError.js';

// A rescue team sent to an incident location (UC03 steps 9-11), and the state
// machine its status follows. Each move is checked against the transition
// table, recorded in the status history, and answered with what the assigned
// team's status must become - the service applies that to the team, so this
// class never touches another record.
//
// Built from a Dispatch document; nothing here knows about the database.
export class Dispatch {
  static MAX_DECLINE_REASON = 200;

  // From each status, the moves allowed and where they lead. `team` is the
  // assigned team's new status, or null when it stays as it is.
  static #TRANSITIONS = {
    [DispatchStatus.ASSIGNED]: {
      acknowledge: { to: DispatchStatus.ACKNOWLEDGED, team: null },
      // A3: the team never left, so it is free again.
      decline: { to: DispatchStatus.DECLINED, team: TeamStatus.AVAILABLE },
      // E4: nobody answered before the deadline, so the team can't be counted
      // on until an officer marks it available again.
      markUnresponsive: { to: DispatchStatus.UNRESPONSIVE, team: TeamStatus.UNAVAILABLE },
    },
    [DispatchStatus.ACKNOWLEDGED]: {
      markOnSite: { to: DispatchStatus.ON_SITE, team: TeamStatus.ON_SITE },
    },
    [DispatchStatus.ON_SITE]: {
      complete: { to: DispatchStatus.COMPLETED, team: TeamStatus.AVAILABLE },
    },
  };

  // Every move's verb, so a refused move can say what was attempted.
  static #VERBS = {
    acknowledge: 'acknowledged',
    decline: 'declined',
    markUnresponsive: 'marked unresponsive',
    markOnSite: 'marked on site',
    complete: 'completed',
  };

  #dispatchId;
  #team;
  #status;
  #createdAt;
  #ackDeadline;
  #statusHistory;
  #declineReason;

  constructor({
    dispatchId,
    team = null,
    status,
    createdAt,
    ackDeadline = null,
    statusHistory = [],
    declineReason = null,
  } = {}) {
    if (dispatchId === undefined || dispatchId === null) {
      throw new Error('Dispatch needs a dispatchId');
    }
    if (!Object.values(DispatchStatus).includes(status)) {
      throw new Error(`Unknown dispatch status: ${status}`);
    }
    this.#dispatchId = String(dispatchId);
    this.#team = team;
    this.#status = status;
    this.#createdAt = createdAt ? new Date(createdAt) : undefined;
    this.#ackDeadline = ackDeadline ? new Date(ackDeadline) : null;
    this.#statusHistory = statusHistory.map((entry) => ({ ...entry }));
    this.#declineReason = declineReason;
  }

  /**
   * Maps a Dispatch document (hydrated, lean or toJSON form) onto the domain class.
   * @param {object} doc
   * @returns {Dispatch}
   */
  static fromDocument(doc) {
    const fields = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return new Dispatch({ ...fields, dispatchId: fields._id ?? fields.id });
  }

  /** The dispatch's id, as a string. */
  get dispatchId() {
    return this.#dispatchId;
  }

  /** The assigned team: its id, or a populated RescueTeam document. */
  get team() {
    return this.#team;
  }

  get status() {
    return this.#status;
  }

  get createdAt() {
    return this.#createdAt;
  }

  get ackDeadline() {
    return this.#ackDeadline;
  }

  /** Why the lead declined (A3), or null. */
  get declineReason() {
    return this.#declineReason;
  }

  /** [{ status, at, by }], oldest first, as a copy. */
  get statusHistory() {
    return this.#statusHistory.map((entry) => ({ ...entry }));
  }

  /**
   * UC03 step 10: the team lead accepts the assignment. ASSIGNED only; the
   * team stays DISPATCHED while it travels.
   * @param {object} by The lead (a user id or User).
   * @param {Date} at
   * @returns {{ teamStatus: string|null }} The team's new status, or null for no change.
   * @throws {InvalidDispatchTransitionError} From any other status.
   */
  acknowledge(by, at) {
    return this.#move('acknowledge', by, at);
  }

  /**
   * UC03 A3: the team lead turns the assignment down, with a reason. ASSIGNED
   * only; the team is AVAILABLE again and the officer picks another team.
   * @param {string} reason 1-200 characters once trimmed.
   * @param {object} by The lead.
   * @param {Date} at
   * @returns {{ teamStatus: string|null }}
   * @throws {Error} For a missing or over-long reason.
   * @throws {InvalidDispatchTransitionError} From any status but ASSIGNED.
   */
  decline(reason, by, at) {
    const trimmed = typeof reason === 'string' ? reason.trim() : '';
    if (trimmed.length < 1 || trimmed.length > Dispatch.MAX_DECLINE_REASON) {
      throw new Error(`A decline needs a reason of 1-${Dispatch.MAX_DECLINE_REASON} characters`);
    }
    const result = this.#move('decline', by, at);
    this.#declineReason = trimmed;
    return result;
  }

  /**
   * Whether the lead has run out of time to answer (UC03 E4): the dispatch is
   * still ASSIGNED and `now` is after the acknowledgement deadline. At exactly
   * the deadline there is still time, so it is not overdue.
   * @param {Date} now
   * @returns {boolean}
   */
  isOverdue(now) {
    return (
      this.#status === DispatchStatus.ASSIGNED &&
      this.#ackDeadline !== null &&
      new Date(now).getTime() > this.#ackDeadline.getTime()
    );
  }

  /**
   * UC03 E4.1: nobody answered before the deadline. Only an overdue ASSIGNED
   * dispatch can be marked; the team becomes UNAVAILABLE. Recorded in the
   * history with no author, since the system does it, not a person.
   * @param {Date} at When it is being marked.
   * @returns {{ teamStatus: string|null }}
   * @throws {InvalidDispatchTransitionError} From any status but ASSIGNED.
   * @throws {Error} When the deadline hasn't passed yet.
   */
  markUnresponsive(at) {
    if (!this.can('markUnresponsive')) {
      throw new InvalidDispatchTransitionError(this.#status, 'marked unresponsive');
    }
    if (!this.isOverdue(at)) {
      throw new Error('A dispatch can only be marked unresponsive after its deadline');
    }
    return this.#move('markUnresponsive', null, at);
  }

  /**
   * UC03 step 11: the team has arrived. ACKNOWLEDGED only; the team goes ON_SITE.
   * @param {object} by The lead.
   * @param {Date} at
   * @returns {{ teamStatus: string|null }}
   * @throws {InvalidDispatchTransitionError} From any other status.
   */
  markOnSite(by, at) {
    return this.#move('markOnSite', by, at);
  }

  /**
   * UC03 step 11: the job is done. ON_SITE only; the team is AVAILABLE again.
   * @param {object} by The lead.
   * @param {Date} at
   * @returns {{ teamStatus: string|null }}
   * @throws {InvalidDispatchTransitionError} From any other status.
   */
  complete(by, at) {
    return this.#move('complete', by, at);
  }

  /**
   * Whether the transition table allows a move from the current status.
   * @param {string} action e.g. "acknowledge"
   * @returns {boolean}
   */
  can(action) {
    return Boolean(Dispatch.#TRANSITIONS[this.#status]?.[action]);
  }

  #move(action, by, at) {
    const transition = Dispatch.#TRANSITIONS[this.#status]?.[action];
    if (!transition) {
      throw new InvalidDispatchTransitionError(this.#status, Dispatch.#VERBS[action]);
    }
    this.#status = transition.to;
    this.#statusHistory.push({ status: transition.to, at: new Date(at), by: by ?? null });
    return { teamStatus: transition.team };
  }
}
