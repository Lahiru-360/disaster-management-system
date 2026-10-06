import { warningService as defaultWarningService } from '../services/WarningService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/hazard-alerts (UC01, contract §12): the WarningController
// of the sequence diagram. It only passes the signed-in officer, the alert id
// and the validated body to WarningService and writes the envelope.
export class HazardAlertController extends BaseController {
  #warningService;

  constructor(warningService = defaultWarningService) {
    super();
    this.#warningService = warningService;
  }

  // POST /api/hazard-alerts - UC01 steps 1-2 (§12.2), or A1 when the body
  // names a confirmed report to escalate (§12.10).
  async startDraft(req, res) {
    const { sourceReportId } = req.body;
    const data = sourceReportId
      ? await this.#warningService.escalateFromReport(req.user, sourceReportId)
      : { alert: await this.#warningService.startDraft(req.user) };

    ApiResponse.success(res, data, 201);
  }

  // POST /api/hazard-alerts/:id/preview - UC01 steps 3-7 (§12.3).
  async preview(req, res) {
    const preview = await this.#warningService.preview(req.params.id, req.body);

    ApiResponse.success(res, preview, 200);
  }

  // PATCH /api/hazard-alerts/:id/draft - UC01 step 8 (§12.4).
  async saveDraftMessage(req, res) {
    const alert = await this.#warningService.saveDraftMessage(req.params.id, req.body.message);

    ApiResponse.success(res, { alert }, 200);
  }

  // GET /api/hazard-alerts/:id (§12.5).
  async getById(req, res) {
    const alert = await this.#warningService.findById(req.params.id);

    ApiResponse.success(res, { alert }, 200);
  }
}

export const hazardAlertController = new HazardAlertController();
