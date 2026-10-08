import { exportService as defaultExportService } from '../services/ExportService.js';
import { postEventReportService as defaultPostEventReportService } from '../services/PostEventReportService.js';
import { shareService as defaultShareService } from '../services/ShareService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/post-event-reports (UC04, contract §14): the
// ReportController of the sequence diagram. It only passes the signed-in
// officer, the id and the validated input to PostEventReportService (or
// ExportService for exports, ShareService for shares) and writes the envelope.
export class PostEventReportController extends BaseController {
  #reportService;
  #exportService;
  #shareService;

  constructor(
    reportService = defaultPostEventReportService,
    exportService = defaultExportService,
    shareService = defaultShareService,
  ) {
    super();
    this.#reportService = reportService;
    this.#exportService = exportService;
    this.#shareService = shareService;
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

  // POST /api/post-event-reports/:id/exports - UC04 steps 12-13 (§14.8).
  async createExport(req, res) {
    const created = await this.#exportService.generateFile(
      req.user,
      req.params.id,
      req.body.format,
    );

    ApiResponse.success(res, created, 201);
  }

  // POST /api/post-event-reports/:id/shares - UC04 steps 14-15 (§14.9).
  async createShare(req, res) {
    const share = await this.#shareService.share(req.user, req.params.id, req.body);

    ApiResponse.success(res, share, 201);
  }

  // GET /api/post-event-reports/:id/shares (§14.10).
  async listShares(req, res) {
    const shares = await this.#shareService.listForReport(req.params.id);

    ApiResponse.success(res, { shares }, 200);
  }

  // GET /api/post-event-reports?eventId= (§14.5).
  async list(req, res) {
    const reports = await this.#reportService.listForEvent(req.query.eventId);

    ApiResponse.success(res, { reports }, 200);
  }
}

export const postEventReportController = new PostEventReportController();
