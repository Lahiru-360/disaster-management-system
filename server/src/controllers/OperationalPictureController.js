import { operationalPictureService as defaultOperationalPictureService } from '../services/OperationalPictureService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/operational-picture (UC03 steps 1-2 and 14).
export class OperationalPictureController extends BaseController {
  #operationalPictureService;

  constructor(operationalPictureService = defaultOperationalPictureService) {
    super();
    this.#operationalPictureService = operationalPictureService;
  }

  async get(req, res) {
    const picture = await this.#operationalPictureService.getCombinedPictureFor(
      req.user,
      req.query,
    );

    ApiResponse.success(res, picture, 200);
  }
}

export const operationalPictureController = new OperationalPictureController();
