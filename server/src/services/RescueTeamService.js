import { RescueTeam as RescueTeamModel } from '../models/RescueTeam.js';
import { CoordinationPresenter } from './CoordinationPresenter.js';
import { districtScope as defaultDistrictScope } from './DistrictScope.js';

// UC03 rescue teams and their owning organisations. Every collaborator comes
// through the constructor.
export class RescueTeamService {
  #rescueTeamModel;
  #districtScope;

  constructor({ rescueTeamModel = RescueTeamModel, districtScope = defaultDistrictScope } = {}) {
    this.#rescueTeamModel = rescueTeamModel;
    this.#districtScope = districtScope;
  }

  /**
   * The rescue teams of the district the caller may see, with their owning
   * organisation and status, sorted by name, in the contract's shape (§13.2).
   * @param {object} user The signed-in User.
   * @param {{ districtId?: string }} [query]
   * @returns {Promise<object[]>}
   */
  async list(user, { districtId } = {}) {
    const district = await this.#districtScope.readableDistrict(user, districtId);
    const docs = await this.#rescueTeamModel
      .find({ district })
      .sort({ name: 1 })
      .populate(CoordinationPresenter.TEAM_POPULATE);
    return docs.map((doc) => CoordinationPresenter.team(doc));
  }
}

export const rescueTeamService = new RescueTeamService();
