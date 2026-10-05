import { hazardEventService as defaultHazardEventService } from '../services/HazardEventService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/hazard-events: the incidents, read-only.
export class HazardEventController extends BaseController {
  #hazardEventService;

  constructor(hazardEventService = defaultHazardEventService) {
    super();
    this.#hazardEventService = hazardEventService;
  }

  async list(req, res) {
    const hazardEvents = await this.#hazardEventService.list(req.query);

    ApiResponse.success(res, { hazardEvents }, 200);
  }
}

export const hazardEventController = new HazardEventController();
