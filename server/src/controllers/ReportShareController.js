import { shareService as defaultShareService } from '../services/ShareService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/report-shares (UC04 E4, contract §14.11): it only passes
// the share id to ShareService and writes the envelope.
export class ReportShareController extends BaseController {
  #shareService;

  constructor(shareService = defaultShareService) {
    super();
    this.#shareService = shareService;
  }

  // POST /api/report-shares/:id/retry - UC04 E4.2 (§14.11).
  async retry(req, res) {
    const share = await this.#shareService.retry(req.params.id);

    ApiResponse.success(res, share, 200);
  }
}

export const reportShareController = new ReportShareController();
