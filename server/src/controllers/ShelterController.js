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

  async create(req, res) {
    const result = await this.#shelterService.create(req.user, req.body);

    ApiResponse.success(res, result, 201);
  }

  async updateOccupancy(req, res) {
    const result = await this.#shelterService.updateOccupancy(req.user, req.params.id, req.body);

    ApiResponse.success(res, result, 200);
  }
}

export const shelterController = new ShelterController();
