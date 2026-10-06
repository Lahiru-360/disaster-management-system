import { EventStatus } from '../enums/EventStatus.js';
import { HazardEvent as HazardEventModel } from '../models/HazardEvent.js';
import { ApiError } from '../utils/ApiError.js';

// The UC03 precondition "An incident is active for the district": the
// district's ACTIVE hazard event. Every officer write checks it first
// (contract §13.1), so nothing is changed outside an incident.
export class ActiveIncident {
  #hazardEventModel;

  constructor({ hazardEventModel = HazardEventModel } = {}) {
    this.#hazardEventModel = hazardEventModel;
  }

  /**
   * The district's ACTIVE hazard event, or null. A district has at most one
   * (§8); the most recent start wins if the data ever says otherwise.
   * @param {object|string} districtId
   * @returns {Promise<object|null>}
   */
  find(districtId) {
    return this.#hazardEventModel
      .findOne({ status: EventStatus.ACTIVE, districts: districtId })
      .sort({ startDate: -1 });
  }

  /**
   * The district's ACTIVE hazard event; refuses the write when there is none.
   * @param {object|string} districtId
   * @returns {Promise<object>}
   * @throws {ApiError} 409 NO_ACTIVE_INCIDENT.
   */
  async require(districtId) {
    const incident = await this.find(districtId);
    if (!incident) {
      throw new ApiError(
        409,
        'NO_ACTIVE_INCIDENT',
        'There is no active incident for this district, so nothing can be changed.',
      );
    }
    return incident;
  }
}

export const activeIncident = new ActiveIncident();
