import { BaseController } from './BaseController.js';

// HTTP layer for /api/health. Responds with a bare status object rather than
// the { success, data } envelope other endpoints use.
export class HealthController extends BaseController {
  check(req, res) {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
}

export const healthController = new HealthController();
