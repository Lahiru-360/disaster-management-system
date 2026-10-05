import { placeService as defaultPlaceService } from '../services/PlaceService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/places: the gazetteer search (UC02 A2).
export class PlaceController extends BaseController {
  #placeService;

  constructor(placeService = defaultPlaceService) {
    super();
    this.#placeService = placeService;
  }

  async search(req, res) {
    const places = await this.#placeService.search(req.query.q);

    ApiResponse.success(res, { places }, 200);
  }
}

export const placeController = new PlaceController();
