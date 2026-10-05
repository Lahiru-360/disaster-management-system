import { HazardEvent as HazardEventModel } from '../models/HazardEvent.js';

// Hazard events (incidents) as reference data: UC03 reads the ACTIVE one for a
// district, UC04 the CLOSED ones to report on. Read-only - opening and closing
// an event is seed-only in this phase.
export class HazardEventService {
  #hazardEventModel;

  constructor({ hazardEventModel = HazardEventModel } = {}) {
    this.#hazardEventModel = hazardEventModel;
  }

  /**
   * Events matching the filters, most recent start first, each with the
   * { id, name } of the districts it affects - for GET /api/hazard-events.
   * Documents, not domain objects: the model's toJSON shapes the response.
   * @param {{ status?: string, districtId?: string }} [filters]
   */
  list({ status, districtId } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (districtId) filter.districts = districtId;

    return this.#hazardEventModel
      .find(filter)
      .sort({ startDate: -1 })
      .populate({ path: 'districts', select: 'name', options: { sort: { name: 1 } } });
  }
}

export const hazardEventService = new HazardEventService();
