import { broadcastService as defaultBroadcastService } from '../services/BroadcastService.js';
import { warningService as defaultWarningService } from '../services/WarningService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/hazard-alerts (UC01, contract §12): the WarningController
// of the sequence diagram. It only passes the signed-in officer, the alert id
// and the validated body to WarningService or BroadcastService and writes
// the envelope.
export class HazardAlertController extends BaseController {
  #warningService;
  #broadcastService;

  constructor(warningService = defaultWarningService, broadcastService = defaultBroadcastService) {
    super();
    this.#warningService = warningService;
    this.#broadcastService = broadcastService;
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

  // GET /api/hazard-alerts?status=draft - UC01 A4 (§12.11).
  async list(req, res) {
    const alerts = await this.#warningService.listDrafts();

    ApiResponse.success(res, { alerts }, 200);
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

  // DELETE /api/hazard-alerts/:id - UC01 A4 (§12.12).
  async discardDraft(req, res) {
    const alert = await this.#warningService.discardDraft(req.params.id);

    ApiResponse.success(res, { alert }, 200);
  }

  // POST /api/hazard-alerts/:id/broadcast - UC01 steps 11-14 (§12.6).
  async broadcast(req, res) {
    const result = await this.#broadcastService.broadcast(
      req.params.id,
      req.user,
      req.body.message,
    );

    ApiResponse.success(res, result, 200);
  }

  // GET /api/hazard-alerts/:id/delivery-summary - UC01 step 14 (§12.7).
  async deliverySummary(req, res) {
    const result = await this.#broadcastService.deliverySummary(req.params.id);

    ApiResponse.success(res, result, 200);
  }
}

export const hazardAlertController = new HazardAlertController();
