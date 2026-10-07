import mongoose from 'mongoose';
import { Citizen } from '../domain/people/Citizen.js';
import { PersonFactory } from '../domain/people/PersonFactory.js';
import { Notification as NotificationModel } from '../models/Notification.js';
import { User as UserModel } from '../models/User.js';

// The registered citizens a hazard warning can reach (UC01 class diagram's
// CitizenRegistry). A citizen is in scope when their home district is one of
// the warning's districts; community volunteers are citizens too, and
// deactivated accounts are never counted. The caller expands a scope's river
// basins to districts first (AreaRegistry), so each citizen is in scope once.
//
// An all-clear (A3) goes instead to an alert's original recipients: whoever
// it was sent to, read from its delivery records, wherever they live now.
export class CitizenRegistry {
  #userModel;
  #notificationModel;

  constructor({ userModel = UserModel, notificationModel = NotificationModel } = {}) {
    this.#userModel = userModel;
    this.#notificationModel = notificationModel;
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

  /**
   * The distinct citizens an alert was sent to (A3.2): everyone with any
   * delivery record for it, of any kind and version, not a recalculated scope,
   * so a citizen who has since moved district is still included.
   * @param {string} alertId
   * @returns {Promise<{ id: string, name: string, phone: string|null, homeDistrictId: string|null }[]>}
   */
  async findOriginalRecipients(alertId) {
    if (!mongoose.isValidObjectId(alertId)) return [];
    const citizenIds = await this.#notificationModel.distinct('citizen', { alert: alertId });
    if (citizenIds.length === 0) return [];
    const users = await this.#userModel
      .find({ _id: { $in: citizenIds } })
      .select('name phone homeDistrict')
      .sort({ _id: 1 })
      .lean();
    return users.map(({ _id, name, phone, homeDistrict }) => ({
      id: _id.toString(),
      name,
      phone: phone ?? null,
      homeDistrictId: homeDistrict ? homeDistrict.toString() : null,
    }));
  }

  /**
   * How many distinct citizens each alert was sent to: who its all-clear
   * would reach (the active list's originalRecipientCount, contract §12.11).
   * @param {string[]} alertIds
   * @returns {Promise<Map<string, number>>} Every given id, 0 when nothing was sent.
   */
  async countOriginalRecipients(alertIds = []) {
    const ids = [...new Set(alertIds.map(String))].filter((id) => mongoose.isValidObjectId(id));
    const counts = new Map(ids.map((id) => [id, 0]));
    if (ids.length === 0) return counts;
    const rows = await this.#notificationModel.aggregate([
      { $match: { alert: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } } },
      { $group: { _id: { alert: '$alert', citizen: '$citizen' } } },
      { $group: { _id: '$_id.alert', count: { $sum: 1 } } },
    ]);
    for (const { _id, count } of rows) counts.set(_id.toString(), count);
    return counts;
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
