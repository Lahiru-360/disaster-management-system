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

  // POST /api/hazard-reports - UC02 steps 5-9 (§9.2). 201 for a new report;
  // 200 with the stored one for a resend of the same clientReportId (A3).
  async submit(req, res) {
    const { report, created } = await this.#hazardReportService.submit(req.user, req.body);

    ApiResponse.success(res, { report }, created ? 201 : 200);
  }

  // GET /api/hazard-reports/mine - the reporter's own reports (§9.3).
  async listMine(req, res) {
    const reports = await this.#hazardReportService.listMine(req.user);

    ApiResponse.success(res, { reports }, 200);
  }

  // GET /api/hazard-reports?status=PENDING - UC02 step 10 (§9.4).
  async listPending(req, res) {
    const clusters = await this.#hazardReportService.getPendingByDistrict(req.user);

    ApiResponse.success(res, { clusters }, 200);
  }

  // GET /api/hazard-reports/:id - UC02 step 11 (§9.5).
  async getDetail(req, res) {
    const detail = await this.#hazardReportService.getDetail(req.params.id, req.user);

    ApiResponse.success(res, detail, 200);
  }

  // POST /api/hazard-reports/:id/confirm - UC02 steps 12-14 (§9.6).
  async confirm(req, res) {
    const report = await this.#hazardReportService.confirm(req.params.id, req.user);

    ApiResponse.success(res, { report }, 200);
  }
}

export const hazardReportController = new HazardReportController();
