import { rescueTeamService as defaultRescueTeamService } from '../services/RescueTeamService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/rescue-teams (UC03).
export class RescueTeamController extends BaseController {
  #rescueTeamService;

  constructor(rescueTeamService = defaultRescueTeamService) {
    super();
    this.#rescueTeamService = rescueTeamService;
  }

  async list(req, res) {
    const teams = await this.#rescueTeamService.list(req.user, req.query);

    ApiResponse.success(res, { teams }, 200);
  }

  async markAvailable(req, res) {
    const team = await this.#rescueTeamService.markAvailable(req.user, req.params.id);

    ApiResponse.success(res, { team }, 200);
  }
}

export const rescueTeamController = new RescueTeamController();
