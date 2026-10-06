import mongoose from 'mongoose';
import { Citizen } from '../domain/people/Citizen.js';
import { PersonFactory } from '../domain/people/PersonFactory.js';
import { User as UserModel } from '../models/User.js';

// The registered citizens a hazard warning can reach (UC01 class diagram's
// CitizenRegistry). A citizen is in scope when their home district is one of
// the warning's districts; community volunteers are citizens too, and
// deactivated accounts are never counted. The caller expands a scope's river
// basins to districts first (AreaRegistry), so each citizen is in scope once.
export class CitizenRegistry {
  #userModel;

  constructor({ userModel = UserModel } = {}) {
    this.#userModel = userModel;
  }

  /**
   * How many distinct citizens live in the districts (step 7).
   * @param {string[]} districtIds
   * @returns {Promise<number>}
   */
  countRecipients(districtIds) {
    const filter = CitizenRegistry.#inScope(districtIds);
    return filter ? this.#userModel.countDocuments(filter) : Promise.resolve(0);
  }

  /**
   * The distinct citizens who live in the districts, to send to (step 13).
   * @param {string[]} districtIds
   * @returns {Promise<{ id: string, name: string, phone: string|null, homeDistrictId: string }[]>}
   */
  async findRecipients(districtIds) {
    const filter = CitizenRegistry.#inScope(districtIds);
    if (!filter) return [];
    const users = await this.#userModel
      .find(filter)
      .select('name phone homeDistrict')
      .sort({ _id: 1 })
      .lean();
    return users.map(({ _id, name, phone, homeDistrict }) => ({
      id: _id.toString(),
      name,
      phone: phone ?? null,
      homeDistrictId: homeDistrict.toString(),
    }));
  }

  // Active citizens (and their subclasses) whose home district is one of the
  // ids, or null when no valid district was given.
  static #inScope(districtIds = []) {
    const ids = [...new Set(districtIds.map(String))].filter((id) => mongoose.isValidObjectId(id));
    if (ids.length === 0) return null;
    return {
      role: { $in: CitizenRegistry.#citizenRoles() },
      isActive: true,
      homeDistrict: { $in: ids },
    };
  }

  // Citizen and every role whose class extends it, from the Person hierarchy.
  static #citizenRoles() {
    return PersonFactory.classes()
      .filter((PersonClass) => PersonClass === Citizen || PersonClass.prototype instanceof Citizen)
      .map((PersonClass) => PersonClass.role);
  }
}

export const citizenRegistry = new CitizenRegistry();
