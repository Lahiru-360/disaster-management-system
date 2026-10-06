import { Shelter as ShelterModel } from '../models/Shelter.js';
import { CoordinationPresenter } from './CoordinationPresenter.js';
import { districtScope as defaultDistrictScope } from './DistrictScope.js';

// UC03 shelters: the ShelterController's work in sequence diagram (a). Every
// collaborator comes through the constructor.
export class ShelterService {
  #shelterModel;
  #districtScope;

  constructor({ shelterModel = ShelterModel, districtScope = defaultDistrictScope } = {}) {
    this.#shelterModel = shelterModel;
    this.#districtScope = districtScope;
  }

  /**
   * The shelters of the district the caller may see (findByDistrict in
   * sequence diagram (a)), sorted by name, in the contract's shape (§13.2).
   * @param {object} user The signed-in User.
   * @param {{ districtId?: string }} [query]
   * @returns {Promise<object[]>}
   */
  async list(user, { districtId } = {}) {
    const district = await this.#districtScope.readableDistrict(user, districtId);
    const docs = await this.#shelterModel
      .find({ district })
      .sort({ name: 1 })
      .populate(CoordinationPresenter.SHELTER_POPULATE);
    return docs.map((doc) => CoordinationPresenter.shelter(doc));
  }
}

export const shelterService = new ShelterService();
