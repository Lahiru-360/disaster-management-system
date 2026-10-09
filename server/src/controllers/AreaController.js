import { areaRegistry as defaultAreaRegistry } from '../services/AreaRegistry.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/districts and /api/river-basins: the registered
// geography, read-only.
export class AreaController extends BaseController {
  #areaRegistry;

  constructor(areaRegistry = defaultAreaRegistry) {
    super();
    this.#areaRegistry = areaRegistry;
  }

  async listDistricts(req, res) {
    const districts = await this.#areaRegistry.listDistricts();

    ApiResponse.success(res, { districts }, 200);
  }

  async listRiverBasins(req, res) {
    const riverBasins = await this.#areaRegistry.listRiverBasins();

    ApiResponse.success(res, { riverBasins }, 200);
  }
}

export const areaController = new AreaController();
