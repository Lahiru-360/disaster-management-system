import { reportShareController } from '../controllers/ReportShareController.js';
import { Role } from '../enums/Role.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { BaseRoutes } from './BaseRoutes.js';

// UC04 report shares (contract §14.11). Creating and listing shares live under
// /api/post-event-reports/:id/shares; a share has its own path once it exists.
// For DMC officers; requireRole admits duty officers too.
export class ReportShareRoutes extends BaseRoutes {
  constructor() {
    super('/api/report-shares');
  }

  registerRoutes(router) {
    router.post(
      '/:id/retry',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DMC_OFFICER),
      reportShareController.retry,
    );
  }
}

export const reportShareRoutes = new ReportShareRoutes();
