import { RescueTeam } from '../domain/coordination/RescueTeam.js';
import { RescueTeam as RescueTeamModel } from '../models/RescueTeam.js';
import { ApiError } from '../utils/ApiError.js';
import { activeIncident as defaultActiveIncident } from './ActiveIncident.js';
import { CoordinationPresenter } from './CoordinationPresenter.js';
import { dispatchService as defaultDispatchService } from './DispatchService.js';
import { districtScope as defaultDistrictScope } from './DistrictScope.js';

// UC03 rescue teams and their owning organisations. Every collaborator comes
// through the constructor.
export class RescueTeamService {
  static #OBJECT_ID = /^[0-9a-fA-F]{24}$/;

  #rescueTeamModel;
  #districtScope;
  #dispatchService;
  #activeIncident;

  constructor({
    rescueTeamModel = RescueTeamModel,
    districtScope = defaultDistrictScope,
    dispatchService = defaultDispatchService,
    activeIncident = defaultActiveIncident,
  } = {}) {
    this.#rescueTeamModel = rescueTeamModel;
    this.#districtScope = districtScope;
    this.#dispatchService = dispatchService;
    this.#activeIncident = activeIncident;
  }

  /**
   * The rescue teams of the district the caller may see, with their owning
   * organisation, status and current task, sorted by name, in the contract's
   * shape (§13.2).
   * @param {object} user The signed-in User.
   * @param {{ districtId?: string }} [query]
   * @returns {Promise<object[]>}
   */
  async list(user, { districtId } = {}) {
    const district = await this.#districtScope.readableDistrict(user, districtId);
    await this.#dispatchService.markOverdueUnresponsive({ district });
    const docs = await this.#rescueTeamModel
      .find({ district })
      .sort({ name: 1 })
      .populate(CoordinationPresenter.TEAM_POPULATE);
    const tasks = await this.#dispatchService.currentTasksFor(docs.map((doc) => doc._id));
    return docs.map((doc) => CoordinationPresenter.team(doc, tasks.get(String(doc._id)) ?? null));
  }

  /**
   * UC03 E4 (contract §13.10.1): puts an UNAVAILABLE team of the officer's
   * district back in the available list. A team that is already AVAILABLE is
   * returned unchanged; one out on a dispatch is refused. A dispatch past its
   * deadline is marked UNRESPONSIVE first, so the team's status is current.
   * @param {object} user The signed-in district officer.
   * @param {string} teamId
   * @returns {Promise<object>} The rescue team object (§13.2).
   * @throws {ApiError} 404 NOT_FOUND, 403 FORBIDDEN, 409 NO_ACTIVE_INCIDENT or
   *   409 INVALID_TEAM_TRANSITION.
   */
  async markAvailable(user, teamId) {
    const found = RescueTeamService.#OBJECT_ID.test(teamId)
      ? await this.#rescueTeamModel.findById(teamId)
      : null;
    if (!found) throw new ApiError(404, 'NOT_FOUND', 'Rescue team not found.');
    this.#districtScope.assertOwnDistrict(user, found.district);
    await this.#activeIncident.require(found.district);
    await this.#dispatchService.markOverdueUnresponsive({ team: found._id });

    // The update only applies while the team is still in the status it was
    // judged in; if it moved meanwhile, it is judged again as it now is.
    let doc = await this.#rescueTeamModel.findById(found._id);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { teamStatus } = RescueTeam.fromDocument(doc).markAvailable();
      if (!teamStatus) break;
      const updated = await this.#rescueTeamModel.findOneAndUpdate(
        { _id: doc._id, status: doc.status },
        { $set: { status: teamStatus } },
        { returnDocument: 'after' },
      );
      if (updated) {
        doc = updated;
        break;
      }
      doc = await this.#rescueTeamModel.findById(found._id);
    }

    await doc.populate(CoordinationPresenter.TEAM_POPULATE);
    const tasks = await this.#dispatchService.currentTasksFor([doc._id]);
    return CoordinationPresenter.team(doc, tasks.get(String(doc._id)) ?? null);
  }
}

export const rescueTeamService = new RescueTeamService();
