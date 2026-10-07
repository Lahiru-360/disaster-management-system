import { postEventReportService as defaultPostEventReportService } from '../services/PostEventReportService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/post-event-reports (UC04, contract §14): the
// ReportController of the sequence diagram. It only passes the signed-in
// officer, the id and the validated input to PostEventReportService and
// writes the envelope.
export class PostEventReportController extends BaseController {
  #reportService;

  constructor(reportService = defaultPostEventReportService) {
    super();
    this.#reportService = reportService;
  }

  // POST /api/post-event-reports - UC04 steps 4-11 (§14.3).
  async generate(req, res) {
    const report = await this.#reportService.generate(req.user, req.body);

    ApiResponse.success(res, { report }, 201);
  }

  // GET /api/post-event-reports/:id (§14.4).
  async getById(req, res) {
    const report = await this.#reportService.findById(req.params.id);

    ApiResponse.success(res, { report }, 200);
  }

  // GET /api/post-event-reports?eventId= (§14.5).
  async list(req, res) {
    const reports = await this.#reportService.listForEvent(req.query.eventId);

    ApiResponse.success(res, { reports }, 200);
  }
}

export const postEventReportController = new PostEventReportController();
