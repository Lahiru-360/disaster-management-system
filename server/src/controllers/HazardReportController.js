import { hazardReportService as defaultHazardReportService } from '../services/HazardReportService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/hazard-reports (UC02, contract §9): the ReportController
// of the sequence diagram. It only passes the signed-in user and the validated
// body to HazardReportService and writes the envelope.
export class HazardReportController extends BaseController {
  #hazardReportService;

  constructor(hazardReportService = defaultHazardReportService) {
    super();
    this.#hazardReportService = hazardReportService;
  }

  // POST /api/hazard-reports - UC02 steps 5-9 (§9.2).
  async submit(req, res) {
    const report = await this.#hazardReportService.submit(req.user, req.body);

    ApiResponse.success(res, { report }, 201);
  }
}

export const hazardReportController = new HazardReportController();
