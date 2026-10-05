import { Organisation as OrganisationModel } from '../models/Organisation.js';

// Organisations as reference data: who holds UC03's stock and teams and who
// UC04 can share a report with. Read-only.
export class OrganisationService {
  #organisationModel;

  constructor({ organisationModel = OrganisationModel } = {}) {
    this.#organisationModel = organisationModel;
  }

  /**
   * Organisations of the given type (every one without it), sorted by name -
   * for GET /api/organisations.
   * @param {{ type?: string }} [filters]
   */
  list({ type } = {}) {
    return this.#organisationModel.find(type ? { type } : {}).sort({ name: 1 });
  }
}

export const organisationService = new OrganisationService();
