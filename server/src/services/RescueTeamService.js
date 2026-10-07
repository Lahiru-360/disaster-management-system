import { RescueTeam as RescueTeamModel } from '../models/RescueTeam.js';
import { CoordinationPresenter } from './CoordinationPresenter.js';
import { dispatchService as defaultDispatchService } from './DispatchService.js';
import { districtScope as defaultDistrictScope } from './DistrictScope.js';

// UC03 rescue teams and their owning organisations. Every collaborator comes
// through the constructor.
export class RescueTeamService {
  #rescueTeamModel;
  #districtScope;
  #dispatchService;

  constructor({
    rescueTeamModel = RescueTeamModel,
    districtScope = defaultDistrictScope,
    dispatchService = defaultDispatchService,
  } = {}) {
    this.#rescueTeamModel = rescueTeamModel;
    this.#districtScope = districtScope;
    this.#dispatchService = dispatchService;
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
}

export const rescueTeamService = new RescueTeamService();
