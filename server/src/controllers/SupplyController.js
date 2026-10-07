import { supplyService as defaultSupplyService } from '../services/SupplyService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for UC03 relief supplies (sequence diagram (c)): the stock the
// Log Relief Supply dialog shows, and logging a distribution.
export class SupplyController extends BaseController {
  #supplyService;

  constructor(supplyService = defaultSupplyService) {
    super();
    this.#supplyService = supplyService;
  }

  async listStock(req, res) {
    const stock = await this.#supplyService.listStock(req.user, req.query);

    ApiResponse.success(res, { stock }, 200);
  }

  async logDistribution(req, res) {
    const result = await this.#supplyService.logDistribution(req.user, req.body);

    ApiResponse.success(res, result, 201);
  }
}

export const supplyController = new SupplyController();
