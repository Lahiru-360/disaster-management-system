import { organisationService as defaultOrganisationService } from '../services/OrganisationService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/organisations: read-only reference data.
export class OrganisationController extends BaseController {
  #organisationService;

  constructor(organisationService = defaultOrganisationService) {
    super();
    this.#organisationService = organisationService;
  }

  async list(req, res) {
    const organisations = await this.#organisationService.list(req.query);

    ApiResponse.success(res, { organisations }, 200);
  }
}

export const organisationController = new OrganisationController();
