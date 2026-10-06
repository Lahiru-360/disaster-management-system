import { shelterService as defaultShelterService } from '../services/ShelterService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/shelters (UC03).
export class ShelterController extends BaseController {
  #shelterService;

  constructor(shelterService = defaultShelterService) {
    super();
    this.#shelterService = shelterService;
  }

  async list(req, res) {
    const shelters = await this.#shelterService.list(req.user, req.query);

    ApiResponse.success(res, { shelters }, 200);
  }
}

export const shelterController = new ShelterController();
