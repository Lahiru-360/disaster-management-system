import { dispatchService as defaultDispatchService } from '../services/DispatchService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for UC03 dispatching (sequence diagram (b)): the officer's
// nearest-team search and dispatch, and the lead's field-app answers.
export class DispatchController extends BaseController {
  #dispatchService;

  constructor(dispatchService = defaultDispatchService) {
    super();
    this.#dispatchService = dispatchService;
  }

  async findAvailableTeams(req, res) {
    const teams = await this.#dispatchService.findNearestAvailable(req.user, req.query);

    ApiResponse.success(res, { teams }, 200);
  }

  async dispatch(req, res) {
    const dispatch = await this.#dispatchService.dispatch(req.user, req.body);

    ApiResponse.success(res, { dispatch }, 201);
  }

  async listMine(req, res) {
    const mine = await this.#dispatchService.listMine(req.user);

    ApiResponse.success(res, mine, 200);
  }

  async acknowledge(req, res) {
    const dispatch = await this.#dispatchService.acknowledge(req.user, req.params.id);

    ApiResponse.success(res, { dispatch }, 200);
  }

  async markOnSite(req, res) {
    const dispatch = await this.#dispatchService.markOnSite(req.user, req.params.id);

    ApiResponse.success(res, { dispatch }, 200);
  }

  async complete(req, res) {
    const dispatch = await this.#dispatchService.complete(req.user, req.params.id);

    ApiResponse.success(res, { dispatch }, 200);
  }
}

export const dispatchController = new DispatchController();
