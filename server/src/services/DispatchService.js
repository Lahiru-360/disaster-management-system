import { Dispatch } from '../domain/coordination/Dispatch.js';
import { env } from '../config/Config.js';
import { DispatchStatus } from '../enums/DispatchStatus.js';
import { NotificationType } from '../enums/NotificationType.js';
import { TeamStatus } from '../enums/TeamStatus.js';
import { Dispatch as DispatchModel } from '../models/Dispatch.js';
import { RescueTeam as RescueTeamModel } from '../models/RescueTeam.js';
import { ApiError } from '../utils/ApiError.js';
import { GeoDistance } from '../utils/GeoDistance.js';
import { systemClock } from '../utils/SystemClock.js';
import { activeIncident as defaultActiveIncident } from './ActiveIncident.js';
import { CoordinationPresenter } from './CoordinationPresenter.js';
import { districtScope as defaultDistrictScope } from './DistrictScope.js';
import { notificationService as defaultNotificationService } from './NotificationService.js';

// UC03 main flow steps 7-11: the DispatchController's work in sequence diagram
// (b). Officers find the nearest available teams and dispatch one; the team's
// lead answers from the field app. The Dispatch domain class decides which
// move is legal; this persists it, applies the team status it returns, and
// sends the notifications. Every collaborator comes through the constructor.
export class DispatchService {
  static #OBJECT_ID = /^[0-9a-fA-F]{24}$/;

  // A dispatch the team is still working on, and one that is over.
  static #OPEN = [DispatchStatus.ASSIGNED, DispatchStatus.ACKNOWLEDGED, DispatchStatus.ON_SITE];
  static #CLOSED = [DispatchStatus.COMPLETED, DispatchStatus.DECLINED, DispatchStatus.UNRESPONSIVE];

  // How many dispatches the console's list returns (§13.7.3).
  static #LIST_LIMIT = 100;

  #dispatchModel;
  #rescueTeamModel;
  #districtScope;
  #activeIncident;
  #notifications;
  #clock;
  #ackTimeoutMinutes;

  constructor({
    dispatchModel = DispatchModel,
    rescueTeamModel = RescueTeamModel,
    districtScope = defaultDistrictScope,
    activeIncident = defaultActiveIncident,
    notifications = defaultNotificationService,
    clock = systemClock,
    ackTimeoutMinutes = env.dispatchAckTimeoutMinutes,
  } = {}) {
    this.#dispatchModel = dispatchModel;
    this.#rescueTeamModel = rescueTeamModel;
    this.#districtScope = districtScope;
    this.#activeIncident = activeIncident;
    this.#notifications = notifications;
    this.#clock = clock;
    this.#ackTimeoutMinutes = ackTimeoutMinutes;
  }

  /**
   * UC03 step 7 (findAvailableTeams in sequence diagram (b), contract §13.6):
   * the district's AVAILABLE teams, nearest to the incident first by
   * straight-line distance from each team's current location, ties by name.
   * An empty list is UC03 E3, not an error.
   * @param {object} user The signed-in district officer.
   * @param {{ lat: number, lng: number, districtId?: string, excludeTeamIds?: string[] }} query
   * @returns {Promise<object[]>} Rescue team objects (§13.2) with distanceKm.
   */
  async findNearestAvailable(user, { lat, lng, districtId, excludeTeamIds = [] }) {
    const district = await this.#districtScope.readableDistrict(user, districtId);
    const docs = await this.#rescueTeamModel
      .find({ district, status: TeamStatus.AVAILABLE, _id: { $nin: excludeTeamIds } })
      .populate(CoordinationPresenter.TEAM_POPULATE);

    return docs
      .map((doc) => ({
        doc,
        metres: GeoDistance.haversineMetres(doc.currentLocation, { lat, lng }),
      }))
      .sort((a, b) => a.metres - b.metres || a.doc.name.localeCompare(b.doc.name))
      .map(({ doc, metres }) => ({
        ...CoordinationPresenter.team(doc),
        distanceKm: Math.round(metres / 100) / 10,
      }));
  }

  /**
   * UC03 steps 8-9 (contract §13.7.2): moves an AVAILABLE team of the
   * officer's district to DISPATCHED - only if it is still AVAILABLE, so two
   * officers can't dispatch the same team - and creates its ASSIGNED dispatch
   * for the district's active incident, with the acknowledgement deadline.
   * The team's lead is notified; a failed notification never fails the dispatch.
   * @param {object} user The signed-in district officer.
   * @param {{ teamId: string, incidentLocation: { lat: number, lng: number, label?: string }, priority: string }} input
   * @returns {Promise<object>} The dispatch object (§13.2).
   * @throws {ApiError} 404 NOT_FOUND, 403 FORBIDDEN, 409 NO_ACTIVE_INCIDENT or 409 TEAM_NOT_AVAILABLE.
   */
  async dispatch(user, { teamId, incidentLocation, priority }) {
    const team = await this.#findTeam(teamId);
    this.#districtScope.assertOwnDistrict(user, team.district);
    const incident = await this.#activeIncident.require(team.district);

    const claimed = await this.#rescueTeamModel.findOneAndUpdate(
      { _id: team._id, status: TeamStatus.AVAILABLE },
      { $set: { status: TeamStatus.DISPATCHED } },
      { returnDocument: 'after' },
    );
    if (!claimed) {
      const now = await this.#rescueTeamModel.findById(team._id);
      throw new ApiError(
        409,
        'TEAM_NOT_AVAILABLE',
        `${team.name} is ${now?.status ?? team.status} and can't take a new dispatch.`,
      );
    }

    const createdAt = this.#clock.now();
    let doc;
    try {
      doc = await this.#dispatchModel.create({
        team: team._id,
        district: team.district,
        incident: incident._id,
        incidentLocation,
        priority,
        status: DispatchStatus.ASSIGNED,
        createdBy: user._id,
        createdAt,
        ackDeadline: new Date(createdAt.getTime() + this.#ackTimeoutMinutes * 60 * 1000),
        statusHistory: [{ status: DispatchStatus.ASSIGNED, at: createdAt, by: user._id }],
      });
    } catch (error) {
      // Nothing was dispatched, so the team is free again.
      await this.#rescueTeamModel.updateOne(
        { _id: team._id },
        { $set: { status: TeamStatus.AVAILABLE } },
      );
      throw error;
    }

    await this.#notifyLead(team, doc);
    return this.#present(doc);
  }

  /**
   * The officer console's dispatch list (contract §13.7.3): the dispatches of
   * the district the caller may see, optionally only some statuses, newest
   * first, at most 100. The console polls it for declined or unresponsive
   * dispatches (A3, E4).
   * @param {object} user The signed-in district or DMC officer.
   * @param {{ districtId?: string, status?: string[] }} [query] Validated by the route.
   * @returns {Promise<object[]>} Dispatch objects (§13.2).
   */
  async list(user, { districtId, status = [] } = {}) {
    const district = await this.#districtScope.readableDistrict(user, districtId);
    await this.markOverdueUnresponsive({ district });
    const filter = { district };
    if (status.length > 0) filter.status = { $in: status };

    const docs = await this.#dispatchModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(DispatchService.#LIST_LIMIT)
      .populate(CoordinationPresenter.DISPATCH_POPULATE);
    return docs.map((doc) => CoordinationPresenter.dispatch(doc));
  }

  /**
   * The field app's Assignments tab (contract §13.7.5): the team the lead
   * leads, its open dispatches newest first, then its most recently closed
   * one, so the app can still show "Assignment expired" after a timeout.
   * @param {object} user The signed-in rescue team lead.
   * @returns {Promise<{ team: object|null, dispatches: object[] }>}
   */
  async listMine(user) {
    const own = await this.#rescueTeamModel.exists({ lead: user._id });
    if (!own) return { team: null, dispatches: [] };
    // An unanswered assignment shows as expired now, not at the next job tick,
    // and the team is read after, so its status agrees.
    await this.markOverdueUnresponsive({ team: own._id });
    const team = await this.#rescueTeamModel
      .findById(own._id)
      .populate(CoordinationPresenter.TEAM_POPULATE);

    const [open, lastClosed] = await Promise.all([
      this.#dispatchModel
        .find({ team: team._id, status: { $in: DispatchService.#OPEN } })
        .sort({ createdAt: -1 }),
      this.#dispatchModel
        .findOne({ team: team._id, status: { $in: DispatchService.#CLOSED } })
        .sort({ updatedAt: -1 }),
    ]);
    const docs = lastClosed ? [...open, lastClosed] : open;
    await this.#dispatchModel.populate(docs, CoordinationPresenter.DISPATCH_POPULATE);

    const tasks = await this.currentTasksFor([team._id]);
    return {
      team: CoordinationPresenter.team(team, tasks.get(String(team._id)) ?? null),
      dispatches: docs.map((doc) => CoordinationPresenter.dispatch(doc)),
    };
  }

  /**
   * Each team's open dispatch, for the dashboard's "Current task" column
   * (contract §13.2): { dispatchId, status, priority, incidentLocation } by
   * team id. A team has at most one, since it is dispatched only when AVAILABLE.
   * @param {Array<object|string>} teamIds
   * @returns {Promise<Map<string, object>>}
   */
  async currentTasksFor(teamIds) {
    const open = await this.#dispatchModel.find({
      team: { $in: teamIds },
      status: { $in: DispatchService.#OPEN },
    });
    return new Map(
      open.map((doc) => [
        String(doc.team),
        {
          dispatchId: String(doc._id),
          status: doc.status,
          priority: doc.priority,
          incidentLocation: CoordinationPresenter.dispatch(doc).incidentLocation,
        },
      ]),
    );
  }

  /**
   * UC03 step 10 (contract §13.7.6): the team's lead acknowledges an ASSIGNED dispatch.
   * @param {object} user The signed-in rescue team lead.
   * @param {string} dispatchId
   * @returns {Promise<object>} The dispatch object (§13.2).
   * @throws {ApiError} 404 NOT_FOUND, 403 FORBIDDEN or 409 INVALID_DISPATCH_TRANSITION.
   */
  async acknowledge(user, dispatchId) {
    const { updated } = await this.#leadMoves(user, dispatchId, 'acknowledge');
    return this.#present(updated);
  }

  /**
   * UC03 step 11 (contract §13.7.7): the team has arrived; it goes ON_SITE at
   * the incident location.
   * @param {object} user The signed-in rescue team lead.
   * @param {string} dispatchId
   * @returns {Promise<object>} The dispatch object (§13.2).
   */
  async markOnSite(user, dispatchId) {
    const { updated } = await this.#leadMoves(user, dispatchId, 'markOnSite');
    return this.#present(updated);
  }

  /**
   * UC03 step 11 (contract §13.7.8): the job is done; the team is AVAILABLE again.
   * @param {object} user The signed-in rescue team lead.
   * @param {string} dispatchId
   * @returns {Promise<object>} The dispatch object (§13.2).
   */
  async complete(user, dispatchId) {
    const { updated } = await this.#leadMoves(user, dispatchId, 'complete');
    return this.#present(updated);
  }

  /**
   * UC03 A3 (contract §13.8): the team's lead declines an ASSIGNED dispatch
   * with a reason. The team is AVAILABLE again, and the officer who created
   * the dispatch is told to choose another team; a failed notification never
   * fails the decline.
   * @param {object} user The signed-in rescue team lead.
   * @param {string} dispatchId
   * @param {{ reason: string }} input Validated by the route.
   * @returns {Promise<object>} The dispatch object (§13.2).
   * @throws {ApiError} 404 NOT_FOUND, 403 FORBIDDEN or 409 INVALID_DISPATCH_TRANSITION.
   */
  async decline(user, dispatchId, { reason }) {
    const { updated, team } = await this.#leadMoves(user, dispatchId, 'decline', reason);
    await this.#notifyCreator(updated, {
      type: NotificationType.DISPATCH_DECLINED,
      title: `${team.name} declined`,
      body: `${team.name} declined (${updated.declineReason}) – choose another team`,
    });
    return this.#present(updated);
  }

  // A field-app move: only the lead of the dispatch's team may make it. The
  // domain class checks the move; the update only applies if the status is
  // still the one the move started from, so two taps can't both win.
  async #leadMoves(user, dispatchId, action, ...args) {
    let doc = await this.#findDispatch(dispatchId);
    const team = await this.#rescueTeamModel.findById(doc.team);
    if (!team || String(team.lead) !== String(user._id)) {
      throw new ApiError(403, 'FORBIDDEN', 'Only the lead of the assigned team can do this.');
    }
    // Past its deadline the dispatch is UNRESPONSIVE before the move is tried,
    // so a late answer is refused even if the timeout job hasn't run yet.
    if (await this.#markUnresponsive(doc)) doc = await this.#findDispatch(dispatchId);

    const dispatch = Dispatch.fromDocument(doc);
    const from = dispatch.status;
    const { teamStatus } = dispatch[action](...args, user._id, this.#clock.now());
    const [entry] = dispatch.statusHistory.slice(-1);

    const updated = await this.#dispatchModel.findOneAndUpdate(
      { _id: doc._id, status: from },
      {
        $set: { status: dispatch.status, declineReason: dispatch.declineReason },
        $push: { statusHistory: entry },
      },
      { returnDocument: 'after' },
    );
    if (!updated) {
      // Someone else moved it first; the next read shows where it is now.
      const now = await this.#dispatchModel.findById(doc._id);
      throw new ApiError(
        409,
        'INVALID_DISPATCH_TRANSITION',
        `This dispatch is ${now.status} and can't be changed this way.`,
      );
    }

    if (teamStatus) {
      const teamUpdate = { status: teamStatus };
      if (teamStatus === TeamStatus.ON_SITE) teamUpdate.currentLocation = doc.incidentLocation;
      await this.#rescueTeamModel.updateOne({ _id: team._id }, { $set: teamUpdate });
    }
    return { updated, team };
  }

  /**
   * UC03 E4.1 (contract §13.10): marks every ASSIGNED dispatch in `scope`
   * whose acknowledgement deadline has passed as UNRESPONSIVE, sets its team
   * UNAVAILABLE and tells the officer who created it. Run by the timeout job
   * over everything (`scope` empty), and lazily by reads and actions over
   * the part they touch - a district, a team - so the state is right between
   * job ticks.
   * @param {object} [scope] A filter on Dispatch, e.g. `{ district }` or `{ team }`.
   * @returns {Promise<number>} How many this call marked.
   */
  async markOverdueUnresponsive(scope = {}) {
    const overdue = await this.#dispatchModel.find({
      ...scope,
      status: DispatchStatus.ASSIGNED,
      ackDeadline: { $lt: this.#clock.now() },
    });
    let marked = 0;
    for (const doc of overdue) {
      if (await this.#markUnresponsive(doc)) marked += 1;
    }
    return marked;
  }

  // One overdue dispatch. The update only applies while it is still ASSIGNED,
  // so when the job and a request race, or the lead answers at the last
  // moment, exactly one of them moves it and only that one notifies.
  async #markUnresponsive(doc) {
    const dispatch = Dispatch.fromDocument(doc);
    const now = this.#clock.now();
    if (!dispatch.isOverdue(now)) return false;

    const { teamStatus } = dispatch.markUnresponsive(now);
    const [entry] = dispatch.statusHistory.slice(-1);
    const updated = await this.#dispatchModel.findOneAndUpdate(
      { _id: doc._id, status: DispatchStatus.ASSIGNED },
      { $set: { status: dispatch.status }, $push: { statusHistory: entry } },
      { returnDocument: 'after' },
    );
    if (!updated) return false;

    const team = await this.#rescueTeamModel.findByIdAndUpdate(
      doc.team,
      { $set: { status: teamStatus } },
      { returnDocument: 'after' },
    );
    await this.#notifyCreator(updated, {
      type: NotificationType.DISPATCH_UNRESPONSIVE,
      title: `No response from ${team?.name ?? 'the team'}`,
      body: `No response from ${team?.name ?? 'the team'} – reassign`,
    });
    return true;
  }

  async #findTeam(teamId) {
    const doc = DispatchService.#OBJECT_ID.test(teamId)
      ? await this.#rescueTeamModel.findById(teamId)
      : null;
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Rescue team not found.');
    return doc;
  }

  async #findDispatch(dispatchId) {
    const doc = DispatchService.#OBJECT_ID.test(dispatchId)
      ? await this.#dispatchModel.findById(dispatchId)
      : null;
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Dispatch not found.');
    return doc;
  }

  // sendAssignment(teamLeadId, dispatchId) in sequence diagram (b): the
  // assignment reaches the lead's field app as an inbox item.
  async #notifyLead(team, doc) {
    if (!team.lead) return;
    const { label } = doc.incidentLocation;
    try {
      await this.#notifications.notifyUser(String(team.lead), {
        type: NotificationType.ASSIGNMENT,
        title: `New assignment for ${team.name}`,
        body: `New assignment – ${label ?? 'incident location on the map'} (${doc.priority}). Respond within ${this.#ackTimeoutMinutes} min.`,
        link: `/assignments/${doc.id}`,
      });
    } catch (error) {
      console.error(`Could not notify the lead of ${team.name}:`, error.message);
    }
  }

  // A3 and E4 tell the officer who created the dispatch to reassign it; the
  // link reopens the coordination dashboard on that dispatch.
  async #notifyCreator(doc, { type, title, body }) {
    try {
      await this.#notifications.notifyUser(String(doc.createdBy), {
        type,
        title,
        body,
        link: `/shelter-resources?dispatch=${doc.id}`,
      });
    } catch (error) {
      console.error(`Could not notify the officer about dispatch ${doc.id}:`, error.message);
    }
  }

  async #present(doc) {
    await doc.populate(CoordinationPresenter.DISPATCH_POPULATE);
    return CoordinationPresenter.dispatch(doc);
  }
}

export const dispatchService = new DispatchService();
